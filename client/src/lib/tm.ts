import type { Settings, Status, TunnelProtocol, TunnelType, WireTunnel, Tunnel } from "../types.js";

// Pure presentation helpers (ported from the design prototype's data.jsx).

export const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  connecting: "Connecting",
  inactive: "Inactive",
  error: "Error",
};

export function localUrl(t: Pick<WireTunnel, "localPort" | "path"> & Partial<Pick<WireTunnel, "protocol" | "port">>): string {
  const protocol = t.protocol ?? (t.port === 443 ? "https" : "http");
  return `${protocol}://localhost:${t.localPort}${t.path || ""}`;
}

export function sourceAddr(t: Pick<WireTunnel, "host" | "port" | "path"> & Partial<Pick<WireTunnel, "protocol">>): string {
  const protocol = t.protocol ?? (t.port === 443 ? "https" : "http");
  const defaultPort = protocol === "https" ? 443 : 80;
  const port = t.port === defaultPort ? "" : `:${t.port}`;
  return `${protocol}://${t.host}${port}${t.path || ""}`;
}

export function sshCommand(
  t: Pick<WireTunnel, "localPort" | "host" | "port">,
  s: Settings,
): string {
  const login = s.sshLogin;
  const jump = s.jumpHost;
  return `ssh -N -L ${t.localPort}:${t.host}:${t.port} ${login}@${jump}`;
}

export function relTime(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export function formatDuration(sec: number): string {
  if (sec % 3600 === 0) return `${sec / 3600}h`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}

export function parseDurationInput(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)\s*([smh])?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const multiplier = unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  const seconds = value * multiplier;
  if (!Number.isSafeInteger(seconds)) return null;
  return seconds >= 2 && seconds <= 86400 ? seconds : null;
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Derive the per-second view fields the design markup expects. `now` is passed
 *  so a single ticker can refresh every card consistently. */
export function toView(t: WireTunnel, now: number): Tunnel {
  const lastCheck = t.lastCheckAt != null ? Math.max(0, Math.round((now - t.lastCheckAt) / 1000)) : null;
  const uptime = t.status === "active" && t.startedAt != null ? fmtUptime(now - t.startedAt) : "—";
  return { ...t, lastCheck, uptime };
}

export interface ParsedAddress {
  ok: boolean;
  host?: string;
  port?: number;
  path?: string;
  type?: TunnelType;
  protocol?: TunnelProtocol;
}

/** Client-side preview parser (the server re-validates on create). */
export function parseAddress(raw: string): ParsedAddress {
  if (!raw || !raw.trim()) return { ok: false };
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
      return { ok: false };
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
    if (parts.length > 2) return { ok: false };
    [host, portStr = ""] = parts;
    hasExplicitPort = parts.length === 2;
  }
  if (!host) return { ok: false };
  const looksMcp = /\/mcp\b/i.test(path) || /mcp/i.test(host);
  const type: TunnelType = looksMcp ? "MCP" : "API";
  let port: number;
  if (hasExplicitPort) {
    if (!/^\d+$/.test(portStr)) return { ok: false };
    port = Number(portStr);
  } else if (scheme) {
    port = protocol === "https" ? 443 : 80;
  } else {
    port = type === "MCP" ? 8040 : 443;
    protocol = port === 443 ? "https" : "http";
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false };
  return { ok: true, host, port, path: path.replace(/\/$/, ""), type, protocol };
}
