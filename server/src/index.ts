import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { APP_URL, DATA_DIR, HOST, PORT } from "./config.js";
import * as mgr from "./manager.js";
import { registerRoutes } from "./routes.js";
import * as store from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  await store.load();

  const app = Fastify({ logger: { level: "info" } });

  // Allow the Vite dev server origin (prod is same-origin, so this is harmless).
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") reply.code(204).send();
  });

  await registerRoutes(app);

  // Serve the built client in production (single-process on the laptop).
  const clientDist = path.resolve(__dirname, "../../client/dist");
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, { root: clientDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  }

  mgr.startHealthLoop();

  const shutdown = () => {
    app.log.info("Shutting down — killing ssh tunnels");
    mgr.shutdown();
    app.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ host: HOST, port: PORT });
  app.log.info(`BastionDeck on ${APP_URL}`);
  app.log.info(`BastionDeck data dir: ${DATA_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
