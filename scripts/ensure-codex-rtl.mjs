#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const patcher = path.join(root, "scripts", "patch-codex.mjs");
const defaultApp = "/Applications/Codex.app";
const passthrough = process.argv.slice(2);

function optionValue(name) {
  const index = passthrough.indexOf(name);
  return index === -1 ? null : passthrough[index + 1];
}

function runPatcher(args) {
  return spawnSync(process.execPath, [patcher, ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

function writeResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function isRunning(appPath) {
  const escaped = appPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result = spawnSync("pgrep", ["-f", `${escaped}/Contents/(MacOS/Codex|Resources/codex)`], {
    encoding: "utf8"
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

const appPath = path.resolve(optionValue("--app") || defaultApp);

if (!existsSync(appPath)) {
  console.error(`Codex app not found: ${appPath}`);
  process.exit(1);
}

const status = runPatcher(["status", ...passthrough]);
if (status.status !== 0) {
  writeResult(status);
  process.exit(status.status || 1);
}

if (/Installed:\s+yes/.test(status.stdout)) {
  console.log("Codex RTL support is installed.");
  process.exit(0);
}

if (!passthrough.includes("--force-running") && isRunning(appPath)) {
  console.log("Codex is running; skipping auto-install until the app is closed.");
  process.exit(0);
}

const install = runPatcher(["install", ...passthrough]);
writeResult(install);
process.exit(install.status || 0);
