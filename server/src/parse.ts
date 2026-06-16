import type { TunnelProtocol, TunnelType } from "./types.js";

// Strict validation so nothing user-controlled can break out of the ssh argv.
// (We never use a shell, but defence in depth: reject anything that isn't a
// plausible hostname / port / login / path.)

const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,253}[A-Za-z0-9])?$/;
const LOGIN_RE = /^[A-Za-z0-9._-]{1,64}$/;
const PATH_RE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*$/;
const HEALTH_INTERVAL_RE = /^(\d+)\s*([smh])?$/i;
export const MIN_HEALTH_INTERVAL_SECONDS = 2;
export const MAX_HEALTH_INTERVAL_SECONDS = 86400;

export function isValidHost(h: string): boolean {
  return typeof h === "string" && HOST_RE.test(h) && !h.includes("..");
}

export function isValidPort(p: unknown): p is number {
  return Number.isInteger(p) && (p as number) >= 1 && (p as number) <= 65535;
}

export function isValidLogin(l: string): boolean {
  return typeof l === "string" && LOGIN_RE.test(l);
}

export function isValidPath(p: string): boolean {
  return p === "" || (typeof p === "string" && p.length <= 512 && PATH_RE.test(p));
}

/** Reject key paths with shell/space/newline surprises; argv-safe anyway. */
export function isValidKeyPath(p: string): boolean {
  return p === "" || (typeof p === "string" && p.length <= 1024 && !/[\n\r\0]/.test(p));
}

/** Parse health-check intervals such as 60, "60s", "15m", or "1h" into seconds. */
export function parseHealthInterval(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) return null;
    return raw >= MIN_HEALTH_INTERVAL_SECONDS && raw <= MAX_HEALTH_INTERVAL_SECONDS ? raw : null;
  }
  if (typeof raw !== "string") return null;

  const match = raw.trim().match(HEALTH_INTERVAL_RE);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const multiplier = unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  const seconds = value * multiplier;
  if (!Number.isSafeInteger(seconds)) return null;
  return seconds >= MIN_HEALTH_INTERVAL_SECONDS && seconds <= MAX_HEALTH_INTERVAL_SECONDS ? seconds : null;
}

export interface ParsedAddress {
  ok: boolean;
  host: string;
  port: number;
  path: string;
  type: TunnelType;
  protocol: TunnelProtocol;
  error?: string;
}

/**
 * Parse a pasted internal address: "host:port", a full URL, or "host:port/path".
 * MCP is detected by a /mcp path segment or "mcp" in the host. Mirrors the
 * design-prototype parser but adds strict validation.
 */
export function parseAddress(raw: string): ParsedAddress {
  const fail = (error: string): ParsedAddress =>
    ({ ok: false, host: "", port: 0, path: "", type: "API", protocol: "http", error });

  if (!raw || !raw.trim()) return fail("Empty address");
  const input = raw.trim();
  const scheme = input.match(/^(https?):\/\//i)?.[1]?.toLowerCase() as TunnelProtocol | undefined;

  let path = "";
  let host = "";
  let portStr = "";
  let hasExplicitPort = false;
  let protocol: TunnelProtocol = scheme ?? "https";

  if (scheme) {
    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch {
      return fail("Invalid URL");
    }
    host = parsed.hostname;
    portStr = parsed.port;
    hasExplicitPort = portStr !== "";
    path = parsed.pathname === "/" ? "" : parsed.pathname;
  } else {
    let s = input;
    const slash = s.indexOf("/");
    if (slash >= 0) {
      path = s.slice(slash);
      s = s.slice(0, slash);
    }
    const parts = s.split(":");
    if (parts.length > 2) return fail("Invalid host");
    [host, portStr = ""] = parts;
    hasExplicitPort = parts.length === 2;
  }
  path = path.replace(/\/$/, "");

  if (!host) return fail("Missing host");
  if (!isValidHost(host)) return fail("Invalid host");
  if (path && !isValidPath(path)) return fail("Invalid path");

  const looksMcp = /\/mcp\b/i.test(path) || /mcp/i.test(host);
  const type: TunnelType = looksMcp ? "MCP" : "API";

  let port: number;
  if (hasExplicitPort) {
    if (!/^\d+$/.test(portStr)) return fail("Invalid port");
    port = Number(portStr);
  } else if (scheme) {
    port = protocol === "https" ? 443 : 80;
  } else {
    port = type === "MCP" ? 8040 : 443;
    protocol = port === 443 ? "https" : "http";
  }
  if (!isValidPort(port)) return fail("Invalid port");

  return { ok: true, host, port, path, type, protocol };
}
