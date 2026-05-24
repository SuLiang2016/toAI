# AI Chat Pending Release Handoff

Date: 2026-05-24
App version: `1.0.1`
Release state: internal-only, blocked for public distribution
Active lane: Batch 2 verification stack upgrade

This handoff captures the remaining work after the 2026-05-24 release-confidence refresh closed the real installer-version upgrade gap. It does not reopen the completed 2026-05-23 roadmap Phase 1-6 batch, and it does not treat already-rerun verification gates as pending.

## Current Decision

- Treat the real installer-version upgrade lane as complete for `1.0.0 -> 1.0.1`.
- Preserve the dated upgrade artifacts and migration proof as release evidence, not open work.
- Move the next repo-local lane to Batch 2 verification stack upgrade.
- Keep public distribution explicitly blocked.
- Treat `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` as the dated source of truth for the latest evidence set.

## Already Complete And Still Valid

The following evidence is already recorded and should stay closed unless a later change invalidates it:

- Static verification gate rerun on 2026-05-24:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 1
- Packaging rebuild rerun on 2026-05-24:
  - `pnpm electron-build`
  - `pnpm electron-installer`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 2
- Unpacked packaged-app smoke:
  - Artifact: `output/playwright/packaged-smoke-unpacked-startup-2026-05-24.json`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 3
- Installed packaged-app startup smoke:
  - Artifact: `output/playwright/packaged-smoke-installed-startup-2026-05-24.json`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 4
- Historical local-data compatibility plus current backup restore boundary:
  - Artifact: `output/playwright/cross-version-compatibility-2026-05-24.json`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 5
- Packaged relaunch retention after the packaged origin fix:
  - Artifact: `output/playwright/packaged-retention-fixed-2026-05-24.json`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 6
- Real installer-version upgrade path:
  - Artifacts:
    - `output/playwright/installer-upgrade-smoke-2026-05-24.json`
    - `output/playwright/installer-upgrade-backup-2026-05-24.json`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 8
- Verification command transcript:
  - Artifact: `output/playwright/verification-commands-2026-05-24.txt`

## Active Blockers

### 1. Public distribution infrastructure

- Status: blocked
- Missing prerequisites:
  - signing certificate ownership
  - timestamp server
  - update metadata hosting
  - rollback policy
  - trust-policy owner
- Current evidence:
  - `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 7
- Current boundary:
  - repo-local packaging, startup, relaunch retention, historical compatibility, and real installer-version upgrade evidence are complete
  - public release readiness is not complete
- Done when:
  - all prerequisite owners and infrastructure are explicitly documented, or
  - the release remains clearly labeled internal-only.

## Remaining Work

### 1. Batch 2 verification stack upgrade

- Goal:
  - replace the current partly-manual release confidence model with documented browser and packaged/Electron smoke commands
- Validate:
  - browser workspace flows
  - packaged startup, About, diagnostics, and backup actions
  - integration of the new smoke lane into the repo verification contract
- Done when:
  - the new smoke commands are documented in source control and no longer depend on reconstructing operator steps

### 2. Public distribution ownership

- Keep blocked until:
  - signing, update metadata hosting, rollback ownership, and trust-policy ownership are explicitly assigned

## Resume Commands

Use the existing verification contract when the next lane is ready for revalidation:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
pnpm electron-installer
```

Batch 1 installer-version upgrade evidence is already recorded in `output/playwright/installer-upgrade-smoke-2026-05-24.json`; the next repo-local lane should build the repeatable verification contract around it.

## Handoff Sources

- Release evidence: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md`
- Active lane plan: `docs/NEXT_EXECUTION_PLAN.md`
- Batch plan: `.omx/plans/prd-batched-upgrade-plan-2026-05-24.md`
- Same-version install/reinstall baseline: `docs/RELEASE_RC_EVIDENCE_2026-05-20.md`
- Real installer upgrade artifact: `output/playwright/installer-upgrade-smoke-2026-05-24.json`
- Upgrade-boundary backup artifact: `output/playwright/installer-upgrade-backup-2026-05-24.json`
- Packaged relaunch retention fix: `output/playwright/packaged-retention-fixed-2026-05-24.json`
- Historical compatibility boundary: `output/playwright/cross-version-compatibility-2026-05-24.json`

## Stop Condition

Do not close this handoff until all of the following are true:

- Batch 1 installer-version upgrade evidence remains traceable and uncontested
- the next verification-stack lane is either complete or explicitly handed off with artifact and command ownership
- `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` and `docs/NEXT_EXECUTION_PLAN.md` reflect the latest active lane and blocker state
- public distribution is either still explicitly blocked or fully assigned with documented release infrastructure ownership
