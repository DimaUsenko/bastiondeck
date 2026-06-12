import type { LogLine, PreflightResult, Settings, TunnelSpec, WireTunnel } from "./types.js";

// Same-origin in prod; Vite proxies /api → :8787 in dev.
const BASE = "";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getSettings: () => fetch(`${BASE}/api/settings`).then(json<Settings>),

  getPreflight: (jumpHost?: string) => {
    const qs = jumpHost ? `?jumpHost=${encodeURIComponent(jumpHost)}` : "";
    return fetch(`${BASE}/api/preflight${qs}`).then(json<PreflightResult>);
  },

  saveSettings: (s: Settings) =>
    fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    }).then(json<Settings>),

  listTunnels: () => fetch(`${BASE}/api/tunnels`).then(json<WireTunnel[]>),

  createTunnel: (spec: TunnelSpec) =>
    fetch(`${BASE}/api/tunnels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    }).then(json<WireTunnel>),

  updateTunnel: (id: string, spec: TunnelSpec) =>
    fetch(`${BASE}/api/tunnels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    }).then(json<WireTunnel>),

  deleteTunnel: (id: string) =>
    fetch(`${BASE}/api/tunnels/${id}`, { method: "DELETE" }).then(json<{ ok: boolean }>),

  start: (id: string) => fetch(`${BASE}/api/tunnels/${id}/start`, { method: "POST" }).then(json<WireTunnel>),
  stop: (id: string) => fetch(`${BASE}/api/tunnels/${id}/stop`, { method: "POST" }).then(json<WireTunnel>),
  restart: (id: string) => fetch(`${BASE}/api/tunnels/${id}/restart`, { method: "POST" }).then(json<WireTunnel>),

  suggestPort: () => fetch(`${BASE}/api/suggest-port`).then(json<{ port: number }>),
};

/** Subscribe to live tunnel-state snapshots. Returns an unsubscribe fn. */
export function subscribeTunnels(onSnapshot: (tunnels: WireTunnel[]) => void): () => void {
  const es = new EventSource(`${BASE}/api/stream`);
  es.addEventListener("tunnels", (e) => {
    onSnapshot(JSON.parse((e as MessageEvent).data) as WireTunnel[]);
  });
  return () => es.close();
}

/** Subscribe to a tunnel's log stream (backlog replayed first). */
export function subscribeLogs(id: string, onLine: (line: LogLine) => void): () => void {
  const es = new EventSource(`${BASE}/api/tunnels/${id}/logs`);
  es.addEventListener("log", (e) => {
    onLine(JSON.parse((e as MessageEvent).data) as LogLine);
  });
  return () => es.close();
}
