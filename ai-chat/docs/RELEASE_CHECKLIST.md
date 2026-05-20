# AI Chat Release Checklist

Use this checklist before producing an installer or release artifact.

## Required Gates

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
```

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

## Update Channel

- Auto-update remains deferred.
- Before enabling updates, define stable, beta, and rollback channels.
- Record where release metadata is hosted and how failed rollouts are disabled.

## Rollback

- Keep the previous known-good installer or unpacked artifact.
- Document the app data compatibility expectations before changing local storage schemas.
- Storage migrations must tolerate older records and quarantine malformed local records.

## Installer Behavior

- Verify install, launch, quit, uninstall, and reinstall on a clean Windows profile.
- Verify existing user data survives an app upgrade.
- Verify logs remain sanitized after an install/upgrade failure.
