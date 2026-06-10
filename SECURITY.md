# Security

This project modifies the local Codex macOS app bundle by replacing `app.asar`.

## Reporting

Please open a private security advisory or contact the maintainer before publishing a vulnerability.

## Notes

- Do not paste GitHub tokens, API keys, or other secrets into issues.
- The installer creates `app.asar.codex-rtl-backup` before replacing `app.asar`.
- Review `scripts/patch-codex.mjs` before running it with elevated macOS permissions.
