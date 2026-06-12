import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { LOG_BUFFER, SERIES_LEN } from "./config.js";
import { hub } from "./events.js";
import { probe } from "./health.js";
import { checkJumpHost } from "./preflight.js";
import { buildSshArgs, canConnect } from "./ssh.js";
import * as store from "./store.js";
import type {
  LogLevel,
  LogLine,
  Status,
  TunnelConfig,
  WireTunnel,
} from "./types.js";

interface Runtime {
  status: Status;
  child: ChildProcessWithoutNullStreams | null;
  pid: number | null;
  latency: number | null;
  series: number[];
  error?: string;
  lastCheckAt: number | null;
  startedAt: number | null;
  logs: LogLine[];
  failCount: number;
  manualStop: boolean;
  restarting: boolean;
  restartCount: number;
  restartTimer: NodeJS.Timeout | null;
}

const ACTIVE_TIMEOUT_MS = 15_000; // how long to wait for the local port to open
const MAX_AUTO_RESTART = 5;

const runtimes = new Map<string, Runtime>();

function blankRuntime(): Runtime {
  return {
    status: "inactive",
    child: null,
    pid: null,
    latency: null,
    series: [],
    lastCheckAt: null,
    startedAt: null,
    logs: [],
    failCount: 0,
    manualStop: false,
    restarting: false,
    restartCount: 0,
    restartTimer: null,
  };
}

function rt(id: string): Runtime {
  let r = runtimes.get(id);
  if (!r) {
    r = blankRuntime();
    runtimes.set(id, r);
  }
  return r;
}

// ---- logging -------------------------------------------------------------

function nowTs(): string {
  return new Date().toTimeString().slice(0, 8);
}

function log(id: string, level: LogLevel, msg: string): void {
  const r = rt(id);
  const line: LogLine = { ts: nowTs(), level, msg };
  r.logs.push(line);
  if (r.logs.length > LOG_BUFFER) r.logs.splice(0, r.logs.length - LOG_BUFFER);
  hub.emitLog(id, line);
}

export function getLogs(id: string): LogLine[] {
  return rt(id).logs.slice();
}

// classify a raw ssh stderr line into a log level
function classify(line: string): LogLevel {
  const l = line.toLowerCase();
  if (/(refused|failed|denied|error|unreachable|timed out|closed by)/.test(l)) return "err";
  if (/(warning|retry|disconnect)/.test(l)) return "warn";
  if (/(authenticated|listening|forwarding|established)/.test(l)) return "ok";
  return "info";
}

// ---- serialization -------------------------------------------------------

export function toWire(cfg: TunnelConfig): WireTunnel {
  const r = rt(cfg.id);
  return {
    ...cfg,
    status: r.status,
    latency: r.latency,
    series: r.series.slice(),
    error: r.error,
    lastCheckAt: r.lastCheckAt,
    startedAt: r.startedAt,
  };
}

export function snapshot(): WireTunnel[] {
  return store.getTunnels().map(toWire);
}

function broadcast(): void {
  hub.emitTunnels(snapshot());
}

function setStatus(id: string, status: Status, error?: string): void {
  const r = rt(id);
  r.status = status;
  r.error = error;
  broadcast();
}

// ---- lifecycle -----------------------------------------------------------

export async function start(id: string): Promise<void> {
  const cfg = store.findTunnel(id);
  if (!cfg) throw new Error("Tunnel not found");
  const r = rt(id);
  if (r.status === "active" || r.status === "connecting") return;

  const settings = store.getSettings();
  const jumpHost = cfg.jumpHost || settings.jumpHost;
  const sshLogin = settings.sshLogin;
  if (!sshLogin) {
    const msg = "SSH login is required. Enter your corporate SSH login in Settings.";
    setStatus(cfg.id, "error", msg);
    log(cfg.id, "err", msg);
    return;
  }

  log(cfg.id, "info", `Checking corporate VPN access to ${jumpHost}:22…`);
  const jump = await checkJumpHost(jumpHost);
  if (!jump.ok) {
    const msg = `Corporate VPN or jump host unavailable: ${jump.detail}`;
    setStatus(cfg.id, "error", msg);
    log(cfg.id, "err", msg);
    return;
  }
  log(cfg.id, "ok", `Jump host reachable (${jump.latency}ms)`);

  r.manualStop = false;
  r.failCount = 0;
  r.error = undefined;
  spawnSsh(cfg);
}

function spawnSsh(cfg: TunnelConfig): void {
  const r = rt(cfg.id);
  const settings = store.getSettings();
  let args: string[];
  try {
    args = buildSshArgs(cfg, settings);
  } catch (err) {
    setStatus(cfg.id, "error", (err as Error).message);
    log(cfg.id, "err", (err as Error).message);
    return;
  }

  const jumpHost = cfg.jumpHost || settings.jumpHost;
  const sshLogin = settings.sshLogin;

  r.status = "connecting";
  r.latency = null;
  r.lastCheckAt = null;
  broadcast();
  log(cfg.id, "info", `Opening connection to ${jumpHost}…`);
  log(cfg.id, "info", `Authenticating as ${sshLogin} (publickey)`);

  const child = spawn("ssh", args, { shell: false });
  r.child = child;
  r.pid = child.pid ?? null;

  const onData = (buf: Buffer) => {
    for (const raw of buf.toString().split("\n")) {
      const line = raw.trimEnd();
      if (line) log(cfg.id, classify(line), line);
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  child.on("error", (err) => {
    setStatus(cfg.id, "error", err.message);
    log(cfg.id, "err", `spawn error: ${err.message}`);
  });

  child.on("exit", (code, signal) => {
    r.child = null;
    r.pid = null;
    if (r.restarting) {
      r.restarting = false;
      setTimeout(() => {
        const latest = store.findTunnel(cfg.id);
        if (latest) spawnSsh(latest);
      }, 200);
      return;
    }
    if (r.manualStop) {
      r.status = "inactive";
      r.latency = null;
      r.startedAt = null;
      log(cfg.id, "warn", "Tunnel stopped by user");
      broadcast();
      return;
    }
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    r.status = "error";
    r.error = r.error || `ssh exited (${reason})`;
    r.latency = null;
    r.startedAt = null;
    log(cfg.id, "err", `ssh process exited (${reason})`);
    broadcast();
    maybeAutoRestart(cfg);
  });

  // Wait for the local listener to come up.
  void waitForActive(cfg);
}

async function waitForActive(cfg: TunnelConfig): Promise<void> {
  const r = rt(cfg.id);
  const deadline = Date.now() + ACTIVE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (r.status !== "connecting" || r.child == null) return; // exited/changed
    if (await canConnect(cfg.localPort)) {
      r.status = "active";
      r.startedAt = Date.now();
      r.restartCount = 0;
      r.failCount = 0;
      log(cfg.id, "ok", `Local forward listening on 127.0.0.1:${cfg.localPort}`);
      log(cfg.id, "ok", `Forwarding → ${cfg.host}:${cfg.port}`);
      broadcast();
      void runProbe(cfg); // immediate first health check
      return;
    }
    await delay(500);
  }
  // Timed out waiting for the port — treat as error and tear down.
  if (r.status === "connecting") {
    r.error = "Timed out establishing tunnel";
    log(cfg.id, "err", "Timed out waiting for local forward to open");
    stopChild(cfg.id, /*manual*/ false);
    r.status = "error";
    broadcast();
  }
}

function stopChild(id: string, manual: boolean): void {
  const r = rt(id);
  r.manualStop = manual;
  if (r.restartTimer) {
    clearTimeout(r.restartTimer);
    r.restartTimer = null;
  }
  if (r.child) {
    r.child.kill("SIGTERM");
    // Hard-kill if it lingers.
    const child = r.child;
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 3000);
  }
}

export async function stop(id: string): Promise<void> {
  const cfg = store.findTunnel(id);
  if (!cfg) throw new Error("Tunnel not found");
  const r = rt(id);
  if (r.child) {
    stopChild(id, true);
  } else {
    r.status = "inactive";
    r.latency = null;
    r.startedAt = null;
    broadcast();
  }
}

export async function restart(id: string): Promise<void> {
  const cfg = store.findTunnel(id);
  if (!cfg) throw new Error("Tunnel not found");
  log(id, "warn", "Restarting tunnel…");
  const r = rt(id);
  r.failCount = 0;
  if (r.restartTimer) {
    clearTimeout(r.restartTimer);
    r.restartTimer = null;
  }
  if (r.child) {
    // The exit handler sees `restarting` and re-spawns instead of erroring.
    r.restarting = true;
    r.child.kill("SIGTERM");
  } else {
    spawnSsh(cfg);
  }
}

function maybeAutoRestart(cfg: TunnelConfig): void {
  const r = rt(cfg.id);
  const fresh = store.findTunnel(cfg.id);
  if (!fresh || !fresh.autoRestart) return;
  if (r.restartCount >= MAX_AUTO_RESTART) {
    log(cfg.id, "warn", `Auto-restart gave up after ${MAX_AUTO_RESTART} attempts`);
    return;
  }
  r.restartCount += 1;
  const backoff = Math.min(30_000, 2000 * r.restartCount);
  log(cfg.id, "warn", `Auto-restart in ${Math.round(backoff / 1000)}s (attempt ${r.restartCount}/${MAX_AUTO_RESTART})…`);
  r.restartTimer = setTimeout(() => {
    r.restartTimer = null;
    const latest = store.findTunnel(cfg.id);
    if (latest) spawnSsh(latest);
  }, backoff);
}

// ---- health loop ---------------------------------------------------------

async function runProbe(cfg: TunnelConfig): Promise<void> {
  const r = rt(cfg.id);
  if (r.status !== "active") return;
  const result = await probe(cfg);
  if (r.status !== "active") return; // changed while probing
  r.lastCheckAt = Date.now();
  if (result.ok && result.latency != null) {
    r.failCount = 0;
    r.latency = result.latency;
    r.series.push(result.latency);
    if (r.series.length > SERIES_LEN) r.series.splice(0, r.series.length - SERIES_LEN);
    broadcast();
  } else {
    r.failCount += 1;
    log(cfg.id, "warn", `Health probe failed: ${result.detail}`);
    if (r.failCount >= 2) {
      r.error = result.detail || "Health check failed";
      r.latency = null;
      log(cfg.id, "err", `Tunnel unhealthy — ${r.error}`);
      // Tear down so it reflects as error; child exit drives auto-restart.
      stopChild(cfg.id, false);
      r.status = "error";
      broadcast();
    } else {
      broadcast();
    }
  }
}

let healthTimer: NodeJS.Timeout | null = null;

export function startHealthLoop(): void {
  if (healthTimer) return;
  healthTimer = setInterval(() => {
    const interval = store.getSettings().interval * 1000;
    const now = Date.now();
    for (const cfg of store.getTunnels()) {
      const r = rt(cfg.id);
      if (r.status !== "active") continue;
      const since = r.lastCheckAt ? now - r.lastCheckAt : Infinity;
      if (since >= interval) void runProbe(cfg);
    }
  }, 1000);
}

// ---- bookkeeping ---------------------------------------------------------

/** Drop runtime state for a deleted tunnel. */
export function forget(id: string): void {
  stopChild(id, true);
  runtimes.delete(id);
}

/** Ports currently claimed by tunnel configs (for the port picker). */
export function usedPorts(): Set<number> {
  return new Set(store.getTunnels().map((t) => t.localPort));
}

/** Kill every ssh child (graceful shutdown). */
export function shutdown(): void {
  for (const [id, r] of runtimes) {
    if (r.restartTimer) clearTimeout(r.restartTimer);
    if (r.child) r.child.kill("SIGTERM");
    void id;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
