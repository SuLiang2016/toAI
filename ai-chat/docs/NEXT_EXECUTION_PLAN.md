# AI Chat Next Execution Plan

This file tracks the currently approved execution lane. Update it when the team finishes a batch or deliberately changes direction.

## Current Execution Lane

Batch 2: verification stack upgrade after closing the real installer-version upgrade lane on 2026-05-24.

## Target Result

- Preserve the completed Batch 1 installer-upgrade evidence and keep it traceable in release docs.
- Replace the current partly-manual release confidence model with a documented browser and packaged-app smoke contract.
- Keep public distribution explicitly blocked until signing and update prerequisites exist.

## Work Items

1. Preserve `output/playwright/installer-upgrade-smoke-2026-05-24.json` and `output/playwright/installer-upgrade-backup-2026-05-24.json` as the dated Batch 1 proof for `1.0.0 -> 1.0.1`.
2. Decide the Batch 2 smoke contract surface for browser flow coverage and packaged/Electron startup coverage.
3. Update `scripts/verify-upgrade.mjs` and related test entrypoints so the new smoke lane becomes part of the repo contract instead of operator memory.
4. Document the new verification command sequence in release and planning docs.
5. Keep public distribution blocked until certificate ownership, timestamping, update metadata hosting, rollback policy, and trust-policy ownership exist.

## Required Verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
pnpm electron-installer
```

- Batch 1 evidence is already complete in `output/playwright/installer-upgrade-smoke-2026-05-24.json`.
- Batch 2 should add stable rerunnable smoke commands rather than another one-off operator flow.

## Manual Smoke

1. Preserve the completed installer-upgrade artifact set as baseline evidence, not open work.
2. Add one browser smoke lane that covers key workspace flows under the current app shell.
3. Add one packaged/Electron smoke lane that covers startup, About, diagnostics, and backup actions.
4. Record each Batch 2 addition as `freshly rerun`, `deferred`, or `blocked`, with artifact path and owner/prerequisite notes.

## Stop Condition

Stop only when:

- Batch 1 installer-version upgrade evidence remains traceable and uncontested,
- Batch 2 verification commands are documented in source control and can be rerun without reconstructing operator steps,
- release docs reflect the new verification contract and no longer describe installer-version upgrade evidence as missing,
- public distribution gates remain explicitly blocked or assigned with owners.
