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

const MCP_INIT_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "bastiondeck-probe", version: "0.1.0" },
  },
});

/**
 * For MCP tunnels, send the JSON-RPC `initialize` handshake and look for
 * serverInfo in the response (mirrors the curl probe in CONTEXT.md). SSE
 * (text/event-stream) responses are handled by reading the first data frame.
 */
async function mcpProbe(
  port: number,
  path: string,
  timeoutMs: number,
): Promise<{ ok: boolean; detail: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://localhost:${port}${path || "/mcp"}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: MCP_INIT_BODY,
      signal: ctrl.signal,
    });
    const text = await res.text();
    const hasServerInfo = /"serverInfo"\s*:/.test(text);
    if (res.ok && hasServerInfo) {
      const m = text.match(/"name"\s*:\s*"([^"]+)"/);
      return { ok: true, detail: `initialize → serverInfo${m ? ` (${m[1]})` : ""}` };
    }
    return { ok: false, detail: `initialize → HTTP ${res.status}, no serverInfo` };
  } catch (err) {
    return { ok: false, detail: `initialize failed: ${(err as Error).message}` };
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
    const mcp = await mcpProbe(cfg.localPort, cfg.path, timeoutMs);
    return { ok: mcp.ok, latency: mcp.ok ? latency : null, detail: mcp.detail };
  }
  return { ok: true, latency, detail: `TCP ${latency}ms · 200 OK` };
}
