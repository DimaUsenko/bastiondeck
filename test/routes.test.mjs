import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import test from "node:test";

test("agent status API returns settings, tunnels, and nullable preflight", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "bastiondeck-routes-"));
  process.env.BD_DATA_DIR = dataDir;

  const [{ registerRoutes }, store] = await Promise.all([
    import("../server/dist/routes.js"),
    import("../server/dist/store.js"),
  ]);
  await store.load();
  await store.addTunnel({
    id: "t-agent",
    name: "Internal API",
    type: "API",
    host: "internal-api.example.com",
    port: 8080,
    path: "",
    localPort: 8000,
    autoRestart: false,
  });

  const app = Fastify({ logger: false });
  await registerRoutes(app);

  const status = await app.inject({ method: "GET", url: "/api/status" });
  assert.equal(status.statusCode, 200);
  const body = status.json();
  assert.equal(body.settings.jumpHost, "");
  assert.equal(body.preflight, null);
  assert.equal(body.tunnels.length, 1);
  assert.equal(body.tunnels[0].id, "t-agent");

  const tunnel = await app.inject({ method: "GET", url: "/api/tunnels/t-agent" });
  assert.equal(tunnel.statusCode, 200);
  assert.equal(tunnel.json().name, "Internal API");

  const logs = await app.inject({ method: "GET", url: "/api/tunnels/t-agent/logs/snapshot" });
  assert.equal(logs.statusCode, 200);
  assert.deepEqual(logs.json(), { lines: [] });

  await app.close();
  await rm(dataDir, { recursive: true, force: true });
});
