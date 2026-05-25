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
pnpm smoke:browser
pnpm smoke:packaged
```

Preferred wrapper:

```powershell
pnpm verify:release
```

Record each run with the release evidence template in `docs/RELEASE_EVIDENCE_TEMPLATE.md`, and classify each item as `already evidenced`, `freshly rerun`, or `deferred`.

## Gate States

- `STATIC PASS`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.
- `BROWSER SMOKE PASS`: `pnpm smoke:browser` validated browser workspace rename/search/archive/draft-reload flows against the current production app shell.
- `PACKAGED SMOKE PASS`: `pnpm smoke:packaged` validated unpacked Electron startup, About, diagnostics, sanitized log export, and backup export/restore flows.
- `UNPACKED SMOKE PASS`: `dist/win-unpacked/AI Chat.exe` launched and smoke checks passed.
- `INSTALLER SMOKE PASS`: installer build and install/upgrade smoke passed.
- `BLOCKED`: prerequisite is missing or owned elsewhere.
- `DEFERRED`: intentionally out of scope for this lane.

## Smoke Contract

- `pnpm smoke:browser`
- Covers seeded browser workspace state, rename, search, archive view, and new-chat draft persistence after reload.
- Writes `output/playwright/browser-workspace-smoke-2026-05-24.json` by default.

- `pnpm smoke:packaged`
- Covers `dist/win-unpacked/AI Chat.exe` startup plus About, diagnostics, sanitized log export, backup export, and backup restore.
- Writes `output/playwright/packaged-desktop-smoke-2026-05-24.json` and `output/playwright/packaged-desktop-backup-2026-05-24.json` by default.

- Historical installer install/upgrade evidence remains separate.
- Keep `output/playwright/installer-upgrade-smoke-2026-05-24.json` and `output/playwright/installer-upgrade-backup-2026-05-24.json` as the dated Batch 1 proof for the real `1.0.0 -> 1.0.1` installer path.

## Signing

- Windows code signing is not configured in this repo.
- Current signing ownership contact in `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md`: `1014576698@qq.com`.
- Keep `signAndEditExecutable: false` until a certificate, timestamp server, and signing secret storage are selected.
- Do not ship a public installer from an unsigned build without explicitly documenting the user trust impact.
- Public distribution is `BLOCKED` until the concrete certificate input, secret storage path/service, and timestamp authorities exist.

## Update Channel

- Auto-update remains deferred.
- Before enabling updates, define stable, beta, and rollback channels.
- Record where release metadata is hosted and how failed rollouts are disabled.
- Use `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md` as the source-controlled owner and metadata-hosting contract.
- Current host contract points to `GitHub Releases` at `https://github.com/SuLiang2016/toAI/releases` with a provisional `beta` namespace owner of `1014576698@qq.com`.
- Public update rollout is `DEFERRED` until channels and rollback metadata exist.

## Rollback

- Keep the previous known-good installer or unpacked artifact.
- Document the app data compatibility expectations before changing local storage schemas.
- Storage migrations must tolerate older records and quarantine malformed local records.
- Rollback ownership and incident communication are assigned to `1014576698@qq.com`.
- Rollback readiness is `BLOCKED` until the metadata publication path and previous-known-good channel contract are fully defined.

## Installer Behavior

- Verify install, launch, quit, uninstall, and reinstall on a clean Windows profile.
- Verify existing user data survives an app upgrade.
- Verify logs remain sanitized after an install/upgrade failure.
- Mark any missing install-profile evidence as `BLOCKED` or `DEFERRED` rather than implying public release approval.
