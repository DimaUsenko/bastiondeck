#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(realpathSync(fileURLToPath(import.meta.url))), "..");
const serverEntry = path.join(root, "server", "dist", "index.js");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

const args = process.argv.slice(2);
const env = { ...process.env };
let openBrowser = true;

function take(flag) {
  const idx = args.indexOf(flag);
  if (idx < 0) return undefined;
  const value = args[idx + 1];
  args.splice(idx, 2);
  return value;
}

function help() {
  console.log(`BastionDeck ${packageJson.version}

Usage:
  bastiondeck [options]

Options:
  --host <host>          Bind address, default 127.0.0.1
  --port <port>          Port, default 8787
  --url-host <host>      Hostname shown/opened in the browser URL
  --data-dir <path>      Settings/state directory, default ~/.bastiondeck
  --no-open              Do not open a browser
  --version              Print version
  --help                 Show this help

Examples:
  bastiondeck
  bastiondeck --port 8788
  bastiondeck --url-host bastiondeck.local
  bastiondeck --host 0.0.0.0 --url-host my-laptop.local
`);
}

if (args.includes("--help") || args.includes("-h")) {
  help();
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(packageJson.version);
  process.exit(0);
}

const host = take("--host");
const port = take("--port");
const urlHost = take("--url-host");
const dataDir = take("--data-dir");
if (args.includes("--no-open")) {
  openBrowser = false;
  args.splice(args.indexOf("--no-open"), 1);
}

if (args.length) {
  console.error(`Unknown option: ${args[0]}`);
  console.error("Run bastiondeck --help for usage.");
  process.exit(2);
}

if (!existsSync(serverEntry)) {
  console.error("Build output is missing. Run `npm run build` before starting BastionDeck from this checkout.");
  process.exit(1);
}

if (host) env.BD_HOST = host;
if (port) env.BD_PORT = port;
if (urlHost) env.BD_PUBLIC_HOST = urlHost;
if (dataDir) env.BD_DATA_DIR = dataDir;

const bindHost = env.BD_HOST || env.TM_HOST || "127.0.0.1";
const bindPort = env.BD_PORT || env.TM_PORT || env.PORT || "8787";
const publicHost = env.BD_PUBLIC_HOST || env.TM_PUBLIC_HOST || (bindHost === "0.0.0.0" || bindHost === "::" ? "localhost" : bindHost);
const appUrl = env.BD_APP_URL || env.TM_APP_URL || `http://${publicHost}:${bindPort}`;
env.BD_APP_URL = appUrl;

const child = spawn(process.execPath, [serverEntry], {
  cwd: root,
  env,
  stdio: "inherit",
});

let opened = false;
const openTimer = openBrowser ? setTimeout(() => {
  opened = true;
  openUrl(appUrl);
}, 900) : null;

child.on("exit", (code, signal) => {
  if (openTimer) clearTimeout(openTimer);
  if (!opened && openBrowser && code == null) openUrl(appUrl);
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}

function openUrl(url) {
  const platform = process.platform;
  const command = platform === "darwin"
    ? "open"
    : platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const opener = spawn(command, args, { detached: true, stdio: "ignore" });
  opener.unref();
  console.log(`BastionDeck: ${url}`);
}
