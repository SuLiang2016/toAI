# AI Chat Next Execution Plan

This file tracks the currently approved execution lane. Update it when the team finishes a batch or deliberately changes direction.

## Current Execution Lane

No active implementation lane. The roadmap Phase 1-6 batch closed on 2026-05-23.

## Target Result

- Preserve the completed 2026-05-23 execution evidence for roadmap phases 1-6.
- Keep public distribution explicitly blocked until signing and update prerequisites exist.
- Start a new lane only after choosing between cross-version installer upgrade evidence, fresh interactive packaged smoke, or a new product direction.

## Work Items

1. Preserve `docs/RELEASE_RC_EVIDENCE_2026-05-20.md` as already-recorded baseline evidence.
2. Preserve `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` as the 2026-05-23 delta-closure record.
3. Keep `docs/NEXT_UPGRADE_ROADMAP.md` and `.omx/plans/roadmap-ai-chat-next-stage-product-2026-05-23.md` aligned with the completed batch.
4. Do not open a public-distribution lane until signing, update metadata hosting, rollback policy, and trust-policy ownership exist.

## Required Verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
pnpm electron-installer
```

- Run `pnpm electron-dev` or packaged interactive smoke only when a future lane changes runtime-only Electron behavior or explicitly refreshes packaged UI evidence.

## Manual Smoke

1. If refreshing packaged UI evidence, launch the packaged desktop app.
2. Confirm startup diagnostics, About, backup export/restore, and sanitized log actions.
3. Capture whether each step is `already evidenced`, `freshly rerun`, or `deferred`.

## Stop Condition

Stop only when:

- the completed batch remains documented without contradictory backlog language,
- verification commands and packaged-artifact evidence stay traceable to a dated record,
- known gaps remain recorded as gaps rather than implied passes,
- public distribution gates remain blocked or deferred with owner notes,
- docs reflect the completed 2026-05-23 roadmap batch rather than the older in-flight release lane.
