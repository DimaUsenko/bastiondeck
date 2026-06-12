import assert from "node:assert/strict";
import test from "node:test";
import { buildSshArgs } from "../server/dist/ssh.js";

test("ssh args use the settings login instead of a legacy tunnel login", () => {
  const args = buildSshArgs({
    id: "t1",
    name: "Internal API",
    type: "API",
    host: "internal-api.example.com",
    port: 8080,
    path: "",
    localPort: 8000,
    autoRestart: false,
    jumpHost: "bastion.example.com",
    sshLogin: "legacy-user",
  }, {
    jumpHost: "default-bastion.example.com",
    jumpHosts: ["default-bastion.example.com", "bastion.example.com"],
    sshLogin: "jdoe",
    keyPath: "",
    portFrom: 8000,
    portTo: 9999,
    interval: 10,
  });

  assert.equal(args.at(-1), "jdoe@bastion.example.com");
});
