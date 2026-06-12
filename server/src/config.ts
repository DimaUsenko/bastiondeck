import os from "node:os";
import path from "node:path";
import type { Settings } from "./types.js";

/** Local runtime/data dir, kept outside the repo. */
function dataDir(): string {
  const raw = (process.env.BD_DATA_DIR || process.env.TM_DATA_DIR)?.trim();
  if (!raw) return path.join(os.homedir(), ".bastiondeck");
  if (raw === "~") return os.homedir();
  if (raw.startsWith("~/")) return path.join(os.homedir(), raw.slice(2));
  return path.resolve(raw);
}

function validPort(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : fallback;
}

function urlHost(host: string): string {
  const publicHost = (process.env.BD_PUBLIC_HOST || process.env.TM_PUBLIC_HOST)?.trim();
  if (publicHost) return publicHost;
  if (host === "0.0.0.0" || host === "::") return "localhost";
  return host;
}

export const DATA_DIR = dataDir();
export const STATE_FILE = path.join(DATA_DIR, "state.json");

export const HOST = (process.env.BD_HOST || process.env.TM_HOST)?.trim() || "127.0.0.1";
export const PORT = validPort(process.env.BD_PORT || process.env.TM_PORT || process.env.PORT, 8787);
export const APP_URL = (process.env.BD_APP_URL || process.env.TM_APP_URL)?.trim() || `http://${urlHost(HOST)}:${PORT}`;

/** Defaults seeded from CONTEXT.md (the user's real jump host / login). */
export const DEFAULT_SETTINGS: Settings = {
  jumpHost: "",
  jumpHosts: [],
  sshLogin: "",
  keyPath: "",
  portFrom: 8000,
  portTo: 9999,
  interval: 10,
};

/** Number of latency samples kept for the sparkline / chart. */
export const SERIES_LEN = 28;
/** Max log lines retained in memory per tunnel. */
export const LOG_BUFFER = 200;

/** Expand a leading ~ to the user's home dir (for keyPath). */
export function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}
