// Shared domain types for the BastionDeck backend.

export type TunnelType = "MCP" | "API";
export type Status = "connecting" | "active" | "inactive" | "error";
export type LogLevel = "info" | "ok" | "warn" | "err";

export interface Settings {
  jumpHost: string;
  /** Known corporate jump hosts offered in selects. */
  jumpHosts: string[];
  sshLogin: string;
  /** Private key path; "" → rely on ssh-agent / ssh_config. Never logged. */
  keyPath: string;
  portFrom: number;
  portTo: number;
  /** Health-check interval in seconds. */
  interval: number;
}

/** Persisted configuration for a tunnel (no runtime state). */
export interface TunnelConfig {
  id: string;
  name: string;
  type: TunnelType;
  host: string;
  port: number;
  /** "" or e.g. "/mcp"; used only to build probe URLs, never the ssh argv. */
  path: string;
  localPort: number;
  autoRestart: boolean;
  /** Per-tunnel jump host override; falls back to global Settings when undefined. */
  jumpHost?: string;
  /** Legacy persisted field. New SSH sessions always use Settings.sshLogin. */
  sshLogin?: string;
}

export interface LogLine {
  ts: string; // HH:MM:SS
  level: LogLevel;
  msg: string;
}

/** The shape sent to the client over REST / SSE. */
export interface WireTunnel extends TunnelConfig {
  status: Status;
  latency: number | null;
  series: number[];
  error?: string;
  /** epoch ms of last successful/attempted health probe, or null. */
  lastCheckAt: number | null;
  /** epoch ms the current active session started, or null. */
  startedAt: number | null;
}

/** Spec accepted by POST /api/tunnels and PATCH /api/tunnels/:id. */
export interface TunnelSpec {
  name?: string;
  type?: TunnelType;
  host: string;
  port: number;
  path?: string;
  localPort?: number;
  autoRestart?: boolean;
  jumpHost?: string;
}

export type PreflightStatus = "ok" | "warn" | "error";

export interface PreflightCheck {
  ok: boolean;
  detail: string;
  latency: number | null;
}

export interface PreflightResult {
  status: PreflightStatus;
  checkedAt: number;
  jumpHost: string;
  dns: PreflightCheck;
  sshPort: PreflightCheck;
  loginConfigured: boolean;
  keyMode: "agent" | "file";
  message: string;
}

export interface PersistShape {
  settings: Settings;
  tunnels: TunnelConfig[];
}
