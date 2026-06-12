import type { TunnelType } from "./types.js";

// Strict validation so nothing user-controlled can break out of the ssh argv.
// (We never use a shell, but defence in depth: reject anything that isn't a
// plausible hostname / port / login / path.)

const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,253}[A-Za-z0-9])?$/;
const LOGIN_RE = /^[A-Za-z0-9._-]{1,64}$/;
const PATH_RE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*$/;

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

export interface ParsedAddress {
  ok: boolean;
  host: string;
  port: number;
  path: string;
  type: TunnelType;
  error?: string;
}

/**
 * Parse a pasted internal address: "host:port", a full URL, or "host:port/path".
 * MCP is detected by a /mcp path segment or "mcp" in the host. Mirrors the
 * design-prototype parser but adds strict validation.
 */
export function parseAddress(raw: string): ParsedAddress {
  const fail = (error: string): ParsedAddress =>
    ({ ok: false, host: "", port: 0, path: "", type: "API", error });

  if (!raw || !raw.trim()) return fail("Empty address");
  let s = raw.trim().replace(/^https?:\/\//i, "");

  let path = "";
  const slash = s.indexOf("/");
  if (slash >= 0) {
    path = s.slice(slash);
    s = s.slice(0, slash);
  }
  path = path.replace(/\/$/, "");

  const [host, portStr] = s.split(":");
  if (!host) return fail("Missing host");
  if (!isValidHost(host)) return fail("Invalid host");
  if (path && !isValidPath(path)) return fail("Invalid path");

  const looksMcp = /\/mcp\b/i.test(path) || /mcp/i.test(host);
  const type: TunnelType = looksMcp ? "MCP" : "API";

  let port = parseInt(portStr, 10);
  if (!port || Number.isNaN(port)) port = type === "MCP" ? 8040 : 8080;
  if (!isValidPort(port)) return fail("Invalid port");

  return { ok: true, host, port, path, type };
}
