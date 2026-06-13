import assert from "node:assert/strict";
import test from "node:test";
import { parseAddress, parseHealthInterval } from "../server/dist/parse.js";

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

test("parseHealthInterval accepts seconds, minutes, and hours", () => {
  assert.equal(parseHealthInterval(60), 60);
  assert.equal(parseHealthInterval("60s"), 60);
  assert.equal(parseHealthInterval("15m"), 900);
  assert.equal(parseHealthInterval("1h"), 3600);
  assert.equal(parseHealthInterval("2h"), 7200);
});

test("parseHealthInterval rejects out-of-range and malformed values", () => {
  assert.equal(parseHealthInterval("1d"), null);
  assert.equal(parseHealthInterval("0s"), null);
  assert.equal(parseHealthInterval("25h"), null);
});
