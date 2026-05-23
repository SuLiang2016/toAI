# AI Chat Release Checklist

Use this checklist before producing an installer or release artifact.

This repo uses an internal RC evidence lane, not public release approval.

## Required Gates

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
pnpm electron-installer
```

Record each run with the release evidence template in `docs/RELEASE_EVIDENCE_TEMPLATE.md`, and classify each item as `already evidenced`, `freshly rerun`, or `deferred`.

## Gate States

- `STATIC PASS`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.
- `UNPACKED SMOKE PASS`: `dist/win-unpacked/AI Chat.exe` launched and smoke checks passed.
- `INSTALLER SMOKE PASS`: installer build and install/upgrade smoke passed.
- `BLOCKED`: prerequisite is missing or owned elsewhere.
- `DEFERRED`: intentionally out of scope for this lane.

## Desktop Smoke

- Launch `dist/win-unpacked/AI Chat.exe`.
- Confirm the main window opens with `nodeIntegration: false` and `contextIsolation: true`.
- Confirm About shows version/platform through the preload bridge.
- Confirm sanitized log export/open works and does not expose API keys, bearer tokens, or local paths.
- Confirm a missing or invalid provider setting produces a sanitized error.

## Signing

- Windows code signing is not configured in this repo.
- Keep `signAndEditExecutable: false` until a certificate, timestamp server, and signing secret storage are selected.
- Do not ship a public installer from an unsigned build without explicitly documenting the user trust impact.
- Public distribution is `BLOCKED` until signing ownership, secret storage, and timestamping exist.

## Update Channel

- Auto-update remains deferred.
- Before enabling updates, define stable, beta, and rollback channels.
- Record where release metadata is hosted and how failed rollouts are disabled.
- Public update rollout is `DEFERRED` until channels and rollback metadata exist.

## Rollback

- Keep the previous known-good installer or unpacked artifact.
- Document the app data compatibility expectations before changing local storage schemas.
- Storage migrations must tolerate older records and quarantine malformed local records.
- Rollback readiness is `BLOCKED` until metadata hosting and trust policy are defined.

## Installer Behavior

- Verify install, launch, quit, uninstall, and reinstall on a clean Windows profile.
- Verify existing user data survives an app upgrade.
- Verify logs remain sanitized after an install/upgrade failure.
- Mark any missing install-profile evidence as `BLOCKED` or `DEFERRED` rather than implying public release approval.
