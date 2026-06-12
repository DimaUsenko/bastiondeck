import net from "node:net";
import { expandHome } from "./config.js";
import {
  isValidHost,
  isValidKeyPath,
  isValidLogin,
  isValidPath,
  isValidPort,
} from "./parse.js";
import type { Settings, TunnelConfig } from "./types.js";

/**
 * Build the ssh argv. Passed to spawn("ssh", argv, { shell: false }) so the
 * values are never interpreted by a shell — no injection is possible. We still
 * validate every interpolated value as defence in depth.
 *
 * We deliberately do NOT use -f (background): keeping the child in-process means
 * we own the PID, can stream stdout/stderr, and detect exit. ExitOnForwardFailure
 * makes ssh exit (rather than hang) if the local bind fails.
 */
export function buildSshArgs(cfg: TunnelConfig, settings: Settings): string[] {
  const jumpHost = cfg.jumpHost || settings.jumpHost;
  const sshLogin = settings.sshLogin;

  if (!isValidHost(cfg.host)) throw new Error(`Invalid target host: ${cfg.host}`);
  if (!isValidHost(jumpHost)) throw new Error(`Invalid jump host: ${jumpHost}`);
  if (!sshLogin) throw new Error("SSH login is required. Enter your corporate SSH login in Settings.");
  if (!isValidLogin(sshLogin)) throw new Error(`Invalid SSH login: ${sshLogin}`);
  if (!isValidPort(cfg.port)) throw new Error(`Invalid target port: ${cfg.port}`);
  if (!isValidPort(cfg.localPort)) throw new Error(`Invalid local port: ${cfg.localPort}`);
  if (!isValidPath(cfg.path)) throw new Error(`Invalid path: ${cfg.path}`);
  if (!isValidKeyPath(settings.keyPath)) throw new Error("Invalid key path");

  const args = [
    "-N",
    "-o", "BatchMode=yes",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=3",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ConnectTimeout=12",
  ];
  if (settings.keyPath) {
    args.push("-i", expandHome(settings.keyPath));
  }
  // Bind the local listener to loopback only.
  args.push("-L", `127.0.0.1:${cfg.localPort}:${cfg.host}:${cfg.port}`);
  args.push(`${sshLogin}@${jumpHost}`);
  return args;
}

/** True if a TCP connection to 127.0.0.1:port succeeds within timeoutMs. */
export function canConnect(port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host: "127.0.0.1", port });
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
  });
}

/** True if nothing is currently listening on 127.0.0.1:port (bindable). */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

/**
 * Pick the lowest free local port in the settings range, skipping ports already
 * claimed by existing tunnel configs and ports currently bound by anything.
 */
export async function suggestPort(
  settings: Settings,
  used: Set<number>,
): Promise<number> {
  const from = isValidPort(settings.portFrom) ? settings.portFrom : 8000;
  const to = isValidPort(settings.portTo) ? settings.portTo : 9999;
  for (let p = from; p <= to; p++) {
    if (used.has(p)) continue;
    if (await isPortFree(p)) return p;
  }
  throw new Error(`No free port available in range ${from}-${to}`);
}
