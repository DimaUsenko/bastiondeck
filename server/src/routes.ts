import type { FastifyInstance, FastifyReply } from "fastify";
import { hub } from "./events.js";
import * as mgr from "./manager.js";
import {
  isValidKeyPath,
  isValidLogin,
  isValidHost,
  isValidPath,
  isValidPort,
  parseAddress,
} from "./parse.js";
import { suggestPort } from "./ssh.js";
import { preflight } from "./preflight.js";
import * as store from "./store.js";
import type { Settings, TunnelConfig, TunnelSpec, TunnelType } from "./types.js";

let idCounter = Date.now();
const newId = (): string => `t${(idCounter++).toString(36)}`;

function sseInit(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  reply.raw.write(": connected\n\n");
}

function sseSend(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** Validate + normalize an incoming tunnel spec into a config patch. */
function normalizeSpec(spec: TunnelSpec): Omit<TunnelConfig, "id"> {
  if (!isValidHost(spec.host)) throw new Error("Invalid host");
  if (!isValidPort(spec.port)) throw new Error("Invalid port");
  const path = spec.path ?? "";
  if (!isValidPath(path)) throw new Error("Invalid path");
  if (spec.localPort != null && !isValidPort(spec.localPort)) throw new Error("Invalid local port");
  if (spec.jumpHost != null && spec.jumpHost !== "" && !isValidHost(spec.jumpHost)) {
    throw new Error("Invalid jump host");
  }
  const type: TunnelType = spec.type === "MCP" || spec.type === "API"
    ? spec.type
    : /\/mcp\b/i.test(path) || /mcp/i.test(spec.host) ? "MCP" : "API";
  const name = (spec.name && spec.name.trim()) || `${spec.host.split(".")[0]}${path ? ` ${type}` : ""}`;
  return {
    name,
    type,
    host: spec.host,
    port: spec.port,
    path,
    localPort: spec.localPort ?? spec.port,
    autoRestart: Boolean(spec.autoRestart),
    jumpHost: spec.jumpHost || undefined,
    sshLogin: undefined,
  };
}

function validateSettings(s: Partial<Settings>): Settings {
  const cur = store.getSettings();
  const next: Settings = { ...cur, ...s };
  next.jumpHosts = Array.isArray(next.jumpHosts)
    ? Array.from(new Set(next.jumpHosts.map((h) => String(h).trim()).filter(Boolean)))
    : [next.jumpHost].filter(Boolean);
  if (next.jumpHost && !next.jumpHosts.includes(next.jumpHost)) next.jumpHosts.unshift(next.jumpHost);
  if (next.jumpHost !== "" && !isValidHost(next.jumpHost)) throw new Error("Invalid jump host");
  for (const host of next.jumpHosts) {
    if (!isValidHost(host)) throw new Error(`Invalid jump host: ${host}`);
  }
  if (next.sshLogin !== "" && !isValidLogin(next.sshLogin)) throw new Error("Invalid SSH login");
  if (!isValidKeyPath(next.keyPath)) throw new Error("Invalid key path");
  next.portFrom = Number(next.portFrom);
  next.portTo = Number(next.portTo);
  next.interval = Number(next.interval);
  if (!isValidPort(next.portFrom) || !isValidPort(next.portTo) || next.portFrom > next.portTo) {
    throw new Error("Invalid port range");
  }
  if (!Number.isInteger(next.interval) || next.interval < 2 || next.interval > 3600) {
    throw new Error("Invalid interval");
  }
  return next;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // ---- settings ----
  app.get("/api/settings", async () => store.getSettings());

  app.put<{ Body: Partial<Settings> }>("/api/settings", async (req, reply) => {
    try {
      const next = validateSettings(req.body ?? {});
      return await store.setSettings(next);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get<{ Querystring: { jumpHost?: string } }>("/api/preflight", async (req, reply) => {
    const settings = store.getSettings();
    const jumpHost = req.query.jumpHost || settings.jumpHost;
    if (!isValidHost(jumpHost)) return reply.code(400).send({ error: "Invalid jump host" });
    return preflight(settings, jumpHost);
  });

  // ---- address parsing (for the New-tunnel form) ----
  app.post<{ Body: { address?: string } }>("/api/parse", async (req) => {
    return parseAddress(req.body?.address ?? "");
  });

  // ---- free port suggestion ----
  app.get("/api/suggest-port", async (_req, reply) => {
    try {
      const port = await suggestPort(store.getSettings(), mgr.usedPorts());
      return { port };
    } catch (err) {
      return reply.code(409).send({ error: (err as Error).message });
    }
  });

  // ---- tunnels ----
  app.get("/api/tunnels", async () => mgr.snapshot());

  app.post<{ Body: TunnelSpec }>("/api/tunnels", async (req, reply) => {
    try {
      const cfg = normalizeSpec(req.body);
      const full: TunnelConfig = { id: newId(), ...cfg };
      // Guard against duplicate local ports.
      if (store.getTunnels().some((t) => t.localPort === full.localPort)) {
        return reply.code(409).send({ error: `Local port ${full.localPort} already in use by another tunnel` });
      }
      await store.addTunnel(full);
      void mgr.start(full.id); // auto-start newly created tunnels
      return reply.code(201).send(mgr.toWire(full));
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.patch<{ Params: { id: string }; Body: TunnelSpec }>("/api/tunnels/:id", async (req, reply) => {
    const existing = store.findTunnel(req.params.id);
    if (!existing) return reply.code(404).send({ error: "Not found" });
    try {
      const cfg = normalizeSpec({ ...existing, ...req.body });
      if (store.getTunnels().some((t) => t.id !== req.params.id && t.localPort === cfg.localPort)) {
        return reply.code(409).send({ error: `Local port ${cfg.localPort} already in use by another tunnel` });
      }
      const updated = await store.updateTunnel(req.params.id, cfg);
      return mgr.toWire(updated!);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/tunnels/:id", async (req, reply) => {
    const ok = await store.removeTunnel(req.params.id);
    if (!ok) return reply.code(404).send({ error: "Not found" });
    mgr.forget(req.params.id);
    return { ok: true };
  });

  for (const op of ["start", "stop", "restart"] as const) {
    app.post<{ Params: { id: string } }>(`/api/tunnels/:id/${op}`, async (req, reply) => {
      try {
        await mgr[op](req.params.id);
        const cfg = store.findTunnel(req.params.id);
        return cfg ? mgr.toWire(cfg) : reply.code(404).send({ error: "Not found" });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  }

  // ---- SSE: global tunnel state ----
  app.get("/api/stream", (req, reply) => {
    sseInit(reply);
    sseSend(reply, "tunnels", mgr.snapshot());
    const off = hub.onTunnels((tunnels) => sseSend(reply, "tunnels", tunnels));
    const keepalive = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);
    req.raw.on("close", () => {
      clearInterval(keepalive);
      off();
    });
  });

  // ---- SSE: per-tunnel logs ----
  app.get<{ Params: { id: string } }>("/api/tunnels/:id/logs", (req, reply) => {
    const id = req.params.id;
    sseInit(reply);
    for (const line of mgr.getLogs(id)) sseSend(reply, "log", line);
    const off = hub.onLog(id, (line) => sseSend(reply, "log", line));
    const keepalive = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);
    req.raw.on("close", () => {
      clearInterval(keepalive);
      off();
    });
  });
}
