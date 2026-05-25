# AI Chat Next Execution Plan

This file tracks the currently approved execution lane. Update it when the team finishes a batch or deliberately changes direction.

## Current Execution Lane

Public distribution ownership hold after closing the Batch 2 verification stack upgrade on 2026-05-24.

## Target Result

- Preserve the completed Batch 1 installer-upgrade evidence and the completed Batch 2 smoke-contract evidence.
- Keep the browser and packaged-app smoke commands in source control as the standing repo verification contract.
- Keep public distribution explicitly blocked until signing and update prerequisites exist.

## Work Items

1. Preserve `output/playwright/installer-upgrade-smoke-2026-05-24.json` and `output/playwright/installer-upgrade-backup-2026-05-24.json` as the dated Batch 1 proof for `1.0.0 -> 1.0.1`.
2. Preserve `output/playwright/browser-workspace-smoke-2026-05-24.json` and `output/playwright/packaged-desktop-smoke-2026-05-24.json` as the dated Batch 2 proof for the repeatable smoke contract.
3. Keep `pnpm smoke:browser`, `pnpm smoke:packaged`, and `pnpm verify:release` aligned with `scripts/verify-upgrade.mjs` and the release docs.
4. Keep public distribution blocked until certificate ownership, timestamping, update metadata hosting, rollback policy, and trust-policy ownership exist, with blocker items 1-5 tracked in `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md`.

## Required Verification

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

- Preferred wrapper: `pnpm verify:release`
- Batch 1 evidence is already complete in `output/playwright/installer-upgrade-smoke-2026-05-24.json`.
- Batch 2 is complete once the smoke commands above remain rerunnable without reconstructing operator steps.

## Contract Notes

1. Preserve the completed installer-upgrade artifact set as baseline evidence, not open work.
2. Preserve the completed browser smoke artifact at `output/playwright/browser-workspace-smoke-2026-05-24.json`.
3. Preserve the completed packaged smoke artifacts at `output/playwright/packaged-desktop-smoke-2026-05-24.json` and `output/playwright/packaged-desktop-backup-2026-05-24.json`.
4. Record each verification rerun as `freshly rerun`, `deferred`, or `blocked`, with artifact path and owner/prerequisite notes.

## Stop Condition

Stop only when:

- Batch 1 installer-version upgrade evidence remains traceable and uncontested,
- Batch 2 smoke-contract evidence remains traceable and rerunnable from source control,
- release docs reflect the new verification contract and the active blocker state,
- public distribution gates remain explicitly blocked or assigned with owners.
