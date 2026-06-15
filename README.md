# Codex RTL Support

Right-to-left text support for the Codex macOS desktop app.

[![CI](https://github.com/SaudNull/codex-rtl-support/actions/workflows/ci.yml/badge.svg)](https://github.com/SaudNull/codex-rtl-support/actions/workflows/ci.yml)

![Before and after RTL rendering](docs/before-after.png)

Codex is excellent for Arabic, Hebrew, Persian, Urdu, and other RTL conversations, but the desktop UI can render RTL text inside an LTR flow. This patch adds a small runtime layer that detects the first strong character in chat and composer text, applies the correct `dir`, and leaves code-oriented surfaces alone.

## What It Fixes

- Arabic, Hebrew, Persian, Urdu, and other RTL messages start from the correct side.
- Mixed RTL/LTR text uses browser-native bidi behavior with `unicode-bidi: plaintext`.
- Composer input updates direction while you type.
- Code blocks, diffs, terminal output, file paths, and editor-like surfaces stay left-to-right.

## Demo

Open `docs/demo.html` in a browser to see the same before/after behavior locally.

## Install

```bash
npm install
npm run patch
```

Quit Codex before installing. Reopen it after the installer finishes.

This patch does not add a separate app to launch. Once installed, open Codex normally.

If macOS blocks writes to `/Applications/Codex.app`, run:

```bash
sudo env "PATH=$PATH" npm run patch
```

If it is still blocked, enable Terminal in:

System Settings -> Privacy & Security -> App Management

## Keep It Applied

Codex updates can replace `app.asar`. To let macOS re-check the app and reapply the patch when Codex is closed, install the LaunchAgent:

```bash
npm run keep
```

The agent runs on login, when `app.asar` changes, and every 15 minutes. It skips while Codex is open.

Remove it with:

```bash
npm run unkeep
```

## Uninstall

```bash
npm run restore
```

This restores the `app.asar.codex-rtl-backup` created during install.

## Check

```bash
npm run status
npm test
npm run dry-run
```

If `npm run status` says `Installed: no`, quit Codex and run `npm run patch`, or use `npm run keep` to reapply it automatically after the app is closed.

## How It Works

The installer extracts Codex's `app.asar`, injects two files into `webview/index.html`, rebuilds the archive, stores a backup, then re-signs the app bundle with an ad-hoc signature.

Runtime files:

- `assets/codex-rtl-support.js`
- `assets/codex-rtl-support.css`

Installer:

- `scripts/patch-codex.mjs`

## Supported App

This project targets the macOS desktop build of Codex installed at:

```text
/Applications/Codex.app
```

Use `--app` for another copy:

```bash
node scripts/patch-codex.mjs install --app "/path/to/Codex.app"
```

## Disclaimer

This is an independent community patch. It is not affiliated with OpenAI.
