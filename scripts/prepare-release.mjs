#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const outRoot = path.join(root, "release");
const appDir = path.join(outRoot, `bastiondeck-${pkg.version}`);

await rm(outRoot, { recursive: true, force: true });
await mkdir(appDir, { recursive: true });

for (const entry of [
  "bin",
  "client/dist",
  "client/package.json",
  "server/dist",
  "server/package.json",
  "package.json",
  "package-lock.json",
  "README.md",
]) {
  await cp(path.join(root, entry), path.join(appDir, entry), { recursive: true });
}

await writeFile(path.join(appDir, "INSTALL.txt"), `BastionDeck ${pkg.version}

Requirements:
- Node.js 22+
- OpenSSH client
- Corporate VPN access
- SSH public-key access to the selected jump host

Run:
  node bin/bastiondeck.mjs

Data is stored outside the app in ~/.bastiondeck by default.
Override with BD_DATA_DIR or --data-dir.
`, "utf8");

console.log(appDir);
