# AI Chat Next Execution Plan

This file tracks the currently approved execution lane. Update it when the team finishes a batch or deliberately changes direction.

## Current Execution Lane

Real installer-version upgrade evidence after the 2026-05-24 packaged relaunch retention fix.

## Target Result

- Preserve the completed 2026-05-23 roadmap Phase 1-6 batch as completed work, not backlog.
- Keep the 2026-05-24 static, packaging, unpacked smoke, installed startup smoke, historical compatibility, and packaged relaunch retention evidence traceable.
- Prove at least one real old-installed-build -> current-installed-build upgrade path before claiming full upgrade retention coverage.
- Keep public distribution explicitly blocked until signing and update prerequisites exist.

## Work Items

1. Preserve `docs/RELEASE_RC_EVIDENCE_2026-05-20.md` as the baseline same-version install/reinstall evidence.
2. Preserve `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` as the active dated record for the 2026-05-24 rerun, retention fix, and remaining release gaps.
3. Treat `output/playwright/verification-commands-2026-05-24.txt`, `output/playwright/packaged-smoke-summary-2026-05-24.json`, `output/playwright/packaged-smoke-unpacked-startup-2026-05-24.json`, `output/playwright/packaged-smoke-installed-startup-2026-05-24.json`, `output/playwright/cross-version-compatibility-2026-05-24.json`, and `output/playwright/packaged-retention-fixed-2026-05-24.json` as operator evidence artifacts for this lane.
4. Run one real installer-version upgrade path and capture session retention, provider preset/configuration retention, backup export at the boundary, and restore into the current version.
5. Update `docs/PENDING_RELEASE_HANDOFF_2026-05-24.md` and related release notes after the upgrade lane changes state.
6. Do not open a public-distribution lane until signing, update metadata hosting, rollback policy, and trust-policy ownership exist.

## Required Verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
pnpm electron-installer
```

- Preserve the current packaged relaunch retention evidence by keeping `output/playwright/packaged-retention-fixed-2026-05-24.json` traceable.
- For the current lane, add one real installer-upgrade artifact that distinguishes real version-upgrade behavior from equivalent historical-data compatibility.

## Manual Smoke

1. Install the older packaged build, confirm session and provider state exist, then upgrade to the current installer.
2. Confirm the upgraded installed app still opens prior sessions and provider configuration.
3. Export a backup from the upgrade boundary when possible and restore it into the current version.
4. Record each item as `already evidenced`, `freshly rerun`, `deferred`, or `blocked`, with artifact path and owner/prerequisite notes.

## Stop Condition

Stop only when:

- the completed 2026-05-23 roadmap batch remains documented without contradictory backlog language,
- 2026-05-24 verification and smoke evidence remain traceable to dated records and local artifacts,
- packaged relaunch retention remains recorded as fixed with fresh evidence,
- at least one real installer-version upgrade path is either evidenced with dated artifacts or explicitly carried as the active unresolved gap,
- public distribution gates remain blocked or deferred with owner notes.
