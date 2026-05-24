# AI Chat Pending Release Handoff

Date: 2026-05-24
App version: `1.0.0`
Release state: internal-only, blocked for public distribution
Active lane: real installer-version upgrade evidence

This handoff captures only the remaining release work after the 2026-05-24 evidence refresh and packaged relaunch retention fix. It does not reopen the completed 2026-05-23 roadmap Phase 1-6 batch, and it does not treat already rerun verification gates as pending.

## Current Decision

- Treat packaged relaunch retention as fixed for the current build and keep the fresh retention artifact with the release evidence.
- Move the current release lane to one real installer-version upgrade path.
- Do not claim cross-version installer upgrade retention or public distribution readiness yet.
- Treat `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` as the dated source of truth for the latest evidence refresh.

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
  - local installer generation is evidenced
  - public release readiness is not evidenced
- Done when:
  - all prerequisite owners and infrastructure are explicitly documented, or
  - the release remains clearly labeled internal-only.

## Remaining Work

### 1. Run one real installer-version upgrade path

- Still missing:
  - old installed build -> current installed build upgrade behavior
  - installer/version metadata behavior under a real upgrade path
- Validate:
  - session retention
  - provider presets/configuration retention
  - backup export from the old/current boundary
  - restore into the current version
- Already covered and should not be double-counted:
  - equivalent historical local-data compatibility in `output/playwright/cross-version-compatibility-2026-05-24.json`
  - packaged relaunch retention in `output/playwright/packaged-retention-fixed-2026-05-24.json`
- Done when:
  - at least one real upgrade path is evidenced with dated artifacts and its tested boundary is documented.

### 2. Refresh release documents after upgrade validation

- Update `docs/RELEASE_RC_EVIDENCE_2026-05-23.md`:
  - mark each rerun as `freshly rerun`, `blocked`, or `deferred`
  - keep the 2026-05-24 evidence traceable by artifact path
  - do not reopen completed 2026-05-23 Phase 1-6 work as backlog
- Update `docs/NEXT_EXECUTION_PLAN.md`:
  - current lane should remain `real installer-version upgrade evidence` until the active unresolved lane changes
  - after that, move the plan to the next unresolved lane or record that only external release-infrastructure blockers remain

## Resume Commands

Use the existing verification contract when the installer-upgrade lane is ready for revalidation:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
pnpm electron-installer
```

Packaged relaunch retention is already evidenced in `output/playwright/packaged-retention-fixed-2026-05-24.json`; the next artifact should prove a real installer-version upgrade path.

## Handoff Sources

- Release evidence: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md`
- Active lane plan: `docs/NEXT_EXECUTION_PLAN.md`
- Same-version install/reinstall baseline: `docs/RELEASE_RC_EVIDENCE_2026-05-20.md`
- Smoke summary: `output/playwright/packaged-smoke-summary-2026-05-24.json`
- Packaged relaunch retention fix: `output/playwright/packaged-retention-fixed-2026-05-24.json`
- Historical blocker repro: `output/playwright/packaged-retention-repro-2026-05-24.json`
- Historical compatibility boundary: `output/playwright/cross-version-compatibility-2026-05-24.json`

## Stop Condition

Do not close this handoff until all of the following are true:

- packaged relaunch retention remains fixed with fresh dated evidence for the unpacked and installed executables
- at least one real installer upgrade path has dated evidence and a documented tested boundary
- `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` and `docs/NEXT_EXECUTION_PLAN.md` reflect the latest active lane and blocker state
- public distribution is either still explicitly blocked or fully assigned with documented release infrastructure ownership
