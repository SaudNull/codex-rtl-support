#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const label = "com.saud.codex-rtl-support";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const launchAgents = path.join(homedir(), "Library", "LaunchAgents");
const logs = path.join(homedir(), "Library", "Logs");
const plistPath = path.join(launchAgents, `${label}.plist`);
const logPath = path.join(logs, `${label}.log`);
const ensurePath = path.join(root, "scripts", "ensure-codex-rtl.mjs");
const domain = `gui/${process.getuid()}`;

function xml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function nodePath() {
  for (const candidate of ["/opt/homebrew/bin/node", "/usr/local/bin/node", process.execPath]) {
    if (existsSync(candidate)) return candidate;
  }
  return process.execPath;
}

function launchctl(args, allowFailure = false) {
  const result = spawnSync("launchctl", args, { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
  return result;
}

function plist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(nodePath())}</string>
    <string>${xml(ensurePath)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>WatchPaths</key>
  <array>
    <string>/Applications/Codex.app/Contents/Resources/app.asar</string>
  </array>
  <key>StartInterval</key>
  <integer>900</integer>
  <key>StandardOutPath</key>
  <string>${xml(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(logPath)}</string>
</dict>
</plist>
`;
}

if (process.argv.includes("--uninstall")) {
  launchctl(["bootout", domain, plistPath], true);
  rmSync(plistPath, { force: true });
  console.log(`Removed ${label}.`);
  process.exit(0);
}

mkdirSync(launchAgents, { recursive: true });
mkdirSync(logs, { recursive: true });
writeFileSync(plistPath, plist(), "utf8");

launchctl(["bootout", domain, plistPath], true);
launchctl(["bootstrap", domain, plistPath]);
launchctl(["kickstart", "-k", `${domain}/${label}`], true);

console.log(`Installed ${label}.`);
console.log(`Log: ${logPath}`);
