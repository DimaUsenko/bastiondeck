import assert from "node:assert/strict";
import test from "node:test";
import { parseAddress } from "../server/dist/parse.js";

test("parseAddress accepts MCP URLs", () => {
  const parsed = parseAddress("http://internal-api.example.com:8040/mcp");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.host, "internal-api.example.com");
  assert.equal(parsed.port, 8040);
  assert.equal(parsed.path, "/mcp");
  assert.equal(parsed.type, "MCP");
});

test("parseAddress rejects unsafe hosts", () => {
  const parsed = parseAddress("bad..host:8040/mcp");
  assert.equal(parsed.ok, false);
});
