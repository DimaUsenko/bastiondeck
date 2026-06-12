import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR, STATE_FILE, DEFAULT_SETTINGS } from "./config.js";
import type { PersistShape, Settings, TunnelConfig } from "./types.js";

// Single JSON file holding settings + tunnel configs. Runtime state
// (status/pid/latency/logs) is never persisted — it lives in the manager.

let state: PersistShape = { settings: { ...DEFAULT_SETTINGS }, tunnels: [] };

export async function load(): Promise<PersistShape> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    state = {
      settings: normalizeSettings(parsed.settings),
      tunnels: Array.isArray(parsed.tunnels) ? parsed.tunnels : [],
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to read state file, starting fresh:", (err as Error).message);
    }
    state = { settings: { ...DEFAULT_SETTINGS }, tunnels: [] };
    await persist();
  }
  return state;
}

async function persist(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `state.${process.pid}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, STATE_FILE); // atomic replace
}

export function getSettings(): Settings {
  return { ...state.settings };
}

export async function setSettings(next: Settings): Promise<Settings> {
  state.settings = { ...next, jumpHosts: normalizeJumpHosts(next) };
  await persist();
  return getSettings();
}

function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...(raw ?? {}),
    jumpHosts: normalizeJumpHosts(raw),
  };
  return settings;
}

function normalizeJumpHosts(raw: Partial<Settings> | undefined): string[] {
  const hosts = Array.isArray(raw?.jumpHosts) ? raw.jumpHosts : [];
  const merged = [raw?.jumpHost, ...hosts]
    .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
    .map((h) => h.trim());
  if (merged.length === 0 && raw?.jumpHost == null && raw?.jumpHosts == null) {
    return DEFAULT_SETTINGS.jumpHosts;
  }
  return Array.from(new Set(merged));
}

export function getTunnels(): TunnelConfig[] {
  return state.tunnels.map((t) => ({ ...t }));
}

export function findTunnel(id: string): TunnelConfig | undefined {
  const t = state.tunnels.find((x) => x.id === id);
  return t ? { ...t } : undefined;
}

export async function addTunnel(t: TunnelConfig): Promise<TunnelConfig> {
  state.tunnels.unshift(t);
  await persist();
  return { ...t };
}

export async function updateTunnel(
  id: string,
  patch: Partial<TunnelConfig>,
): Promise<TunnelConfig | undefined> {
  const idx = state.tunnels.findIndex((x) => x.id === id);
  if (idx < 0) return undefined;
  state.tunnels[idx] = { ...state.tunnels[idx], ...patch, id };
  await persist();
  return { ...state.tunnels[idx] };
}

export async function removeTunnel(id: string): Promise<boolean> {
  const before = state.tunnels.length;
  state.tunnels = state.tunnels.filter((x) => x.id !== id);
  if (state.tunnels.length === before) return false;
  await persist();
  return true;
}
