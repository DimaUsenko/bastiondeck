import dns from "node:dns/promises";
import net from "node:net";
import { isValidHost } from "./parse.js";
import type { PreflightCheck, PreflightResult, Settings } from "./types.js";

function fail(detail: string): PreflightCheck {
  return { ok: false, detail, latency: null };
}

async function dnsCheck(host: string, timeoutMs: number): Promise<PreflightCheck> {
  if (!isValidHost(host)) return fail("Invalid jump host");
  const start = performance.now();
  let timer: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      dns.lookup(host),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS lookup timed out")), timeoutMs);
      }),
    ]);
    return { ok: true, detail: "Internal DNS resolved", latency: Math.round(performance.now() - start) };
  } catch (err) {
    return fail((err as Error).message);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function tcpCheck(host: string, port = 22, timeoutMs = 2500): Promise<PreflightCheck> {
  if (!isValidHost(host)) return Promise.resolve(fail("Invalid jump host"));
  return new Promise((resolve) => {
    const start = performance.now();
    const sock = net.connect({ host, port });
    let done = false;
    const finish = (ok: boolean, detail: string) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve({ ok, detail, latency: ok ? Math.round(performance.now() - start) : null });
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true, `TCP ${port} reachable`));
    sock.once("timeout", () => finish(false, `TCP ${port} timed out`));
    sock.once("error", (err) => finish(false, err.message));
  });
}

export async function checkJumpHost(host: string): Promise<PreflightCheck> {
  return tcpCheck(host, 22);
}

export async function preflight(settings: Settings, host = settings.jumpHost): Promise<PreflightResult> {
  const jumpHost = host || settings.jumpHost;
  const [dns, sshPort] = await Promise.all([
    dnsCheck(jumpHost, 2000),
    tcpCheck(jumpHost, 22),
  ]);
  const loginConfigured = settings.sshLogin.trim().length > 0;
  const status = dns.ok && sshPort.ok && loginConfigured ? "ok" : sshPort.ok ? "warn" : "error";
  let message = "Corp. VPN ready";
  if (!sshPort.ok) message = "Corporate VPN or jump host is unavailable";
  else if (!loginConfigured) message = "Enter your SSH login before starting tunnels";

  return {
    status,
    checkedAt: Date.now(),
    jumpHost,
    dns,
    sshPort,
    loginConfigured,
    keyMode: settings.keyPath ? "file" : "agent",
    message,
  };
}
