import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("settings can clear all jump hosts", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "bastiondeck-test-"));
  process.env.BD_DATA_DIR = dataDir;

  const store = await import(`../server/dist/store.js?case=${Date.now()}`);
  await store.load();
  const saved = await store.setSettings({
    jumpHost: "",
    jumpHosts: [],
    sshLogin: "",
    keyPath: "",
    portFrom: 8000,
    portTo: 9999,
    interval: 10,
  });

  assert.equal(saved.jumpHost, "");
  assert.deepEqual(saved.jumpHosts, []);

  await rm(dataDir, { recursive: true, force: true });
});
