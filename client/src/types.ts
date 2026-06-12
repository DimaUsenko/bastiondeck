export type TunnelType = "MCP" | "API";
export type Status = "connecting" | "active" | "inactive" | "error";
export type LogLevel = "info" | "ok" | "warn" | "err";

export interface Settings {
  jumpHost: string;
  jumpHosts: string[];
  sshLogin: string;
  keyPath: string;
  portFrom: number;
  portTo: number;
  interval: number;
}

/** The tunnel object as delivered by the server (REST + SSE). */
export interface WireTunnel {
  id: string;
  name: string;
  type: TunnelType;
  status: Status;
  host: string;
  port: number;
  path: string;
  localPort: number;
  autoRestart: boolean;
  jumpHost?: string;
  sshLogin?: string;
  latency: number | null;
  series: number[];
  error?: string;
  lastCheckAt: number | null;
  startedAt: number | null;
}

/**
 * View model used by the UI components: the wire tunnel plus the
 * derived, per-second fields the design markup expects.
 */
export interface Tunnel extends WireTunnel {
  /** seconds since last health check, or null */
  lastCheck: number | null;
  /** human-readable uptime, e.g. "3d 4h" or "—" */
  uptime: string;
}

export interface LogLine {
  ts: string;
  level: LogLevel;
  msg: string;
}

export interface TunnelSpec {
  name?: string;
  type?: TunnelType;
  host: string;
  port: number;
  path?: string;
  localPort?: number;
  autoRestart?: boolean;
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
