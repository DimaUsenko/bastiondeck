import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { probe } from "../server/dist/health.js";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  });
}

test("MCP health probe treats unauthorized HTTP responses as reachable", async () => {
  let method = "";
  const server = http.createServer((req, res) => {
    method = req.method ?? "";
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("unauthorized");
  });
  const port = await listen(server);
  try {
    const result = await probe({
      id: "t1",
      name: "Langfuse",
      type: "MCP",
      host: "langfuse.example.com",
      port: 8040,
      path: "/api/public/mcp",
      localPort: port,
      autoRestart: false,
    });

    assert.equal(result.ok, true);
    assert.equal(result.latency !== null, true);
    assert.equal(result.detail, "HTTP 401 reachable");
    assert.equal(method, "HEAD");
  } finally {
    await close(server);
  }
});
