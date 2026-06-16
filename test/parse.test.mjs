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
  assert.equal(parsed.protocol, "http");
});

test("parseAddress defaults web URLs from scheme", () => {
  const https = parseAddress("https://internal-app.example.com/team");
  assert.equal(https.ok, true);
  assert.equal(https.host, "internal-app.example.com");
  assert.equal(https.port, 443);
  assert.equal(https.path, "/team");
  assert.equal(https.protocol, "https");

  const http = parseAddress("http://internal-app.example.com");
  assert.equal(http.ok, true);
  assert.equal(http.port, 80);
  assert.equal(http.protocol, "http");
});

test("parseAddress preserves explicit scheme with non-default ports", () => {
  const parsed = parseAddress("http://internal-app.example.com:443");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.port, 443);
  assert.equal(parsed.protocol, "http");
});

test("parseAddress treats bare hosts as HTTPS web apps", () => {
  const parsed = parseAddress("internal-app.example.com");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.host, "internal-app.example.com");
  assert.equal(parsed.port, 443);
  assert.equal(parsed.protocol, "https");
});

test("parseAddress rejects malformed explicit ports", () => {
  assert.equal(parseAddress("internal-app.example.com:abc").ok, false);
  assert.equal(parseAddress("internal-app.example.com:").ok, false);
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
