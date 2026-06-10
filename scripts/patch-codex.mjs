#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  chown,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createPackage, extractAll, extractFile, statFile } from "@electron/asar";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const defaultApp = "/Applications/Codex.app";
const marker = "codex-rtl-support";
const blockPattern = new RegExp(`\\n\\s*<!-- ${marker}:start -->[\\s\\S]*?<!-- ${marker}:end -->`, "g");
const assets = [
  "codex-rtl-support.css",
  "codex-rtl-support.js"
];

function parseArgs(argv) {
  const args = {
    command: "install",
    app: defaultApp,
    dryRun: false,
    sign: true,
    forceRunning: false
  };

  const list = [...argv];
  if (list[0] && !list[0].startsWith("-")) args.command = list.shift();

  for (let index = 0; index < list.length; index += 1) {
    const value = list[index];
    if (value === "--app") args.app = list[++index];
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--no-sign") args.sign = false;
    else if (value === "--force-running") args.forceRunning = true;
    else usage(`Unknown option: ${value}`);
  }

  return args;
}

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: codex-rtl [install|uninstall|status] [--app /Applications/Codex.app] [--dry-run] [--no-sign] [--force-running]");
  process.exit(message ? 1 : 0);
}

function paths(appPath) {
  const resources = path.join(appPath, "Contents", "Resources");
  return {
    appPath,
    resources,
    asar: path.join(resources, "app.asar"),
    backup: path.join(resources, "app.asar.codex-rtl-backup"),
    next: path.join(resources, "app.asar.codex-rtl-next")
  };
}

async function ensureApp(targets) {
  if (!existsSync(targets.appPath)) throw new Error(`Codex app not found: ${targets.appPath}`);
  if (!existsSync(targets.asar)) throw new Error(`app.asar not found: ${targets.asar}`);
  await stat(targets.asar);
}

function commandOk(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function isRunning(appPath) {
  const escaped = appPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result = commandOk("pgrep", ["-f", `${escaped}/Contents/(MacOS/Codex|Resources/codex)`]);
  return result.ok && result.stdout.trim().length > 0;
}

async function fileHash(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function readIndex(asarPath) {
  return extractFile(asarPath, "webview/index.html").toString("utf8");
}

function hasAsarFile(asarPath, file) {
  try {
    return Boolean(statFile(asarPath, file));
  } catch {
    return false;
  }
}

async function verifyPatchedAsar(asarPath) {
  const index = await readIndex(asarPath);
  if (!index.includes(`${marker}:start`)) throw new Error("RTL marker was not injected.");

  for (const asset of assets) {
    const file = `webview/assets/${asset}`;
    if (!hasAsarFile(asarPath, file)) throw new Error(`Missing asset in patched asar: ${file}`);
  }
}

async function isPatched(asarPath) {
  return (await readIndex(asarPath)).includes(`${marker}:start`);
}

function injectIndex(html) {
  const clean = html.replace(blockPattern, "");
  const block = `
    <!-- ${marker}:start -->
    <link rel="stylesheet" crossorigin href="./assets/codex-rtl-support.css">
    <script type="module" crossorigin src="./assets/codex-rtl-support.js"></script>
    <!-- ${marker}:end -->`;

  if (!clean.includes("</head>")) throw new Error("webview/index.html has no </head>");
  return clean.replace("</head>", `${block}\n</head>`);
}

async function patchAsar(sourceAsar, outputAsar) {
  const workdir = await mkdtemp(path.join(tmpdir(), "codex-rtl-asar-"));
  try {
    extractAll(sourceAsar, workdir);

    const webview = path.join(workdir, "webview");
    const indexPath = path.join(webview, "index.html");
    const assetDir = path.join(webview, "assets");

    const index = await readFile(indexPath, "utf8");
    await writeFile(indexPath, injectIndex(index));

    for (const asset of assets) {
      await copyFile(path.join(repoRoot, "assets", asset), path.join(assetDir, asset));
    }

    await rm(outputAsar, { force: true });
    await createPackage(workdir, outputAsar);
  } finally {
    await rm(workdir, { force: true, recursive: true });
  }
}

async function install(args, targets) {
  await ensureApp(targets);

  if (!args.dryRun && !args.forceRunning && isRunning(targets.appPath)) {
    throw new Error("Codex is running. Quit Codex first, then run install again.");
  }

  const sourcePatched = await isPatched(targets.asar);
  const originalStat = await stat(targets.asar);
  const packageDir = await mkdtemp(path.join(tmpdir(), "codex-rtl-package-"));
  const tempAsar = path.join(packageDir, "app.asar");

  try {
    await patchAsar(targets.asar, tempAsar);
    await verifyPatchedAsar(tempAsar);

    if (args.dryRun) {
      console.log(`Dry run OK: ${await fileHash(tempAsar)}`);
      return;
    }

    if (!sourcePatched) {
      await copyFile(targets.asar, targets.backup);
      await chown(targets.backup, originalStat.uid, originalStat.gid).catch(() => {});
    }
    else if (!existsSync(targets.backup)) console.warn("Current app.asar is already patched and no original backup was found.");

    await rm(targets.next, { force: true });
    await copyFile(tempAsar, targets.next);
    await rename(targets.next, targets.asar);
    await chown(targets.asar, originalStat.uid, originalStat.gid).catch(() => {});
    if (args.sign) signApp(targets.appPath);

    console.log("Installed Codex RTL support.");
  } finally {
    await rm(packageDir, { force: true, recursive: true });
    if (!args.dryRun) await rm(targets.next, { force: true });
  }
}

async function uninstall(args, targets) {
  await ensureApp(targets);

  if (!existsSync(targets.backup)) {
    console.log("No Codex RTL backup found.");
    return;
  }

  if (!args.forceRunning && isRunning(targets.appPath)) {
    throw new Error("Codex is running. Quit Codex first, then run uninstall again.");
  }

  await copyFile(targets.backup, targets.asar);
  if (args.sign) signApp(targets.appPath);

  console.log("Restored original app.asar backup.");
}

async function status(targets) {
  await ensureApp(targets);
  const index = await readIndex(targets.asar);
  const installed = index.includes(`${marker}:start`);
  const backup = existsSync(targets.backup);
  console.log(`Installed: ${installed ? "yes" : "no"}`);
  console.log(`Backup: ${backup ? "yes" : "no"}`);
  console.log(`app.asar sha256: ${await fileHash(targets.asar)}`);
}

function signApp(appPath) {
  if (process.platform !== "darwin") return;

  const result = commandOk("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  if (!result.ok) {
    throw new Error(`codesign failed:\n${result.stderr || result.stdout}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = paths(path.resolve(args.app));

  if (args.command === "install") await install(args, targets);
  else if (args.command === "uninstall") await uninstall(args, targets);
  else if (args.command === "status") await status(targets);
  else usage(`Unknown command: ${args.command}`);
}

main().catch(error => {
  if (error?.code === "EPERM" || error?.code === "EACCES") {
    console.error("Permission denied while modifying /Applications/Codex.app.");
    console.error('Run: sudo env "PATH=$PATH" npm run patch');
    process.exit(1);
  }

  console.error(error.message);
  process.exit(1);
});
