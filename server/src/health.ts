import net from "node:net";
import type { TunnelConfig } from "./types.js";

export interface ProbeResult {
  ok: boolean;
  latency: number | null;
  detail: string; // human-readable, for the log stream
}

/** Measure TCP connect latency to 127.0.0.1:port. */
function tcpProbe(port: number, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const sock = net.connect({ host: "127.0.0.1", port });
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok ? Math.round(performance.now() - start) : null);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
  });
}

/**
 * For MCP tunnels, only verify that the HTTP endpoint is reachable. Authenticated
 * MCP servers such as Langfuse may return 401/403 without credentials; that
 * still proves the tunnel reaches the service.
 */
async function httpReachabilityProbe(
  port: number,
  path: string,
  timeoutMs: number,
): Promise<{ ok: boolean; detail: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://localhost:${port}${path || "/mcp"}`, {
      method: "HEAD",
      headers: {
        Accept: "*/*",
      },
      signal: ctrl.signal,
    });
    return { ok: true, detail: `HTTP ${res.status} reachable` };
  } catch (err) {
    return { ok: false, detail: `HTTP probe failed: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Run a health check for one tunnel. */
export async function probe(cfg: TunnelConfig, timeoutMs = 8000): Promise<ProbeResult> {
  const latency = await tcpProbe(cfg.localPort, Math.min(timeoutMs, 2000));
  if (latency == null) {
    return { ok: false, latency: null, detail: "TCP connect refused" };
  }
  if (cfg.type === "MCP") {
    const mcp = await httpReachabilityProbe(cfg.localPort, cfg.path, timeoutMs);
    return { ok: mcp.ok, latency: mcp.ok ? latency : null, detail: mcp.detail };
  }
  return { ok: true, latency, detail: `TCP ${latency}ms` };
}
