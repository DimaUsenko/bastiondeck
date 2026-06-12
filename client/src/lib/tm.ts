import type { Settings, Status, TunnelType, WireTunnel, Tunnel } from "../types.js";

// Pure presentation helpers (ported from the design prototype's data.jsx).

export const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  connecting: "Connecting",
  inactive: "Inactive",
  error: "Error",
};

export function localUrl(t: Pick<WireTunnel, "localPort" | "path">): string {
  return `http://localhost:${t.localPort}${t.path || ""}`;
}

export function sourceAddr(t: Pick<WireTunnel, "host" | "port" | "path">): string {
  return `${t.host}:${t.port}${t.path || ""}`;
}

export function sshCommand(
  t: Pick<WireTunnel, "localPort" | "host" | "port" | "jumpHost" | "sshLogin">,
  s: Settings,
): string {
  const login = t.sshLogin || s.sshLogin;
  const jump = t.jumpHost || s.jumpHost;
  return `ssh -N -L ${t.localPort}:${t.host}:${t.port} ${login}@${jump}`;
}

export function relTime(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
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
}

/** Client-side preview parser (the server re-validates on create). */
export function parseAddress(raw: string): ParsedAddress {
  if (!raw || !raw.trim()) return { ok: false };
  let s = raw.trim().replace(/^https?:\/\//i, "");
  let path = "";
  const slash = s.indexOf("/");
  if (slash >= 0) {
    path = s.slice(slash);
    s = s.slice(0, slash);
  }
  const [host, portStr] = s.split(":");
  if (!host) return { ok: false };
  const looksMcp = /\/mcp\b/i.test(path) || /mcp/i.test(host);
  const type: TunnelType = looksMcp ? "MCP" : "API";
  let port = parseInt(portStr, 10);
  if (!port || Number.isNaN(port)) port = type === "MCP" ? 8040 : 8080;
  return { ok: true, host, port, path: path.replace(/\/$/, ""), type };
}
