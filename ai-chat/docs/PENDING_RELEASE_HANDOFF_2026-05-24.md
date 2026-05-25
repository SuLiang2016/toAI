# AI Chat Pending Release Handoff

Date: 2026-05-24
App version: `1.0.1`
Release state: internal-only, blocked for public distribution
Active lane: public distribution infrastructure hold after the 2026-05-25 ownership refresh

This handoff captures the remaining work after the 2026-05-24 release-confidence refresh closed the real installer-version upgrade gap. It does not reopen the completed 2026-05-23 roadmap Phase 1-6 batch, and it does not treat already-rerun verification gates as pending.

## Current Decision

- Treat the real installer-version upgrade lane as complete for `1.0.0 -> 1.0.1`.
- Preserve the dated upgrade artifacts and migration proof as release evidence, not open work.
- Treat the Batch 2 verification stack upgrade as complete after the repeatable smoke commands were added to source control and rerun.
- Keep public distribution explicitly blocked.
- Treat `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` as the dated source of truth for the latest evidence set.
- Treat the 2026-05-25 owner refresh in `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md` as the current owner contract while keeping unresolved timestamp and metadata details blocked.

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
- Browser workspace smoke contract:
  - Artifact: `output/playwright/browser-workspace-smoke-2026-05-24.json`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 9
- Packaged desktop smoke contract:
  - Artifacts:
    - `output/playwright/packaged-desktop-smoke-2026-05-24.json`
    - `output/playwright/packaged-desktop-backup-2026-05-24.json`
  - Evidence record: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 10
- Verification command transcript:
  - Artifact: `output/playwright/verification-commands-2026-05-24.txt`
- Source-controlled verification wrapper:
  - Command: `pnpm verify:release`

## Active Blockers

### 1. Public distribution infrastructure

- Status: blocked
- Missing prerequisites:
  - selected primary and fallback timestamp authorities
  - selected signing certificate material and signing secret storage path/service
  - stable and rollback-capable release-channel model plus metadata publication path
  - explicit access-policy and promotion-flow details for public release metadata
- Current evidence:
  - `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` Record 7
  - `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md`
- Current boundary:
  - repo-local packaging, startup, relaunch retention, historical compatibility, and real installer-version upgrade evidence are complete
  - public release readiness is not complete
- Done when:
  - all prerequisite owners and remaining release-infrastructure details are explicitly documented, or
  - the release remains clearly labeled internal-only.

## Remaining Work

### 1. Public distribution ownership

- Keep blocked until:
  - primary and fallback timestamp authorities are selected
  - signing certificate material and signing secret storage path/service are selected
  - the metadata publication path plus stable and rollback-capable channel contract are documented
  - `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md` no longer contains `TBD` values for fields still required to ship a public release

## Resume Commands

Use the standing verification contract when the next lane is ready for revalidation:

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

Batch 1 installer-version upgrade evidence is already recorded in `output/playwright/installer-upgrade-smoke-2026-05-24.json`; Batch 2 now preserves the repeatable verification contract around it.

## Handoff Sources

- Release evidence: `docs/RELEASE_RC_EVIDENCE_2026-05-23.md`
- Public-distribution owner contract: `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md`
- Active lane plan: `docs/NEXT_EXECUTION_PLAN.md`
- Batch plan: `.omx/plans/prd-batched-upgrade-plan-2026-05-24.md`
- Same-version install/reinstall baseline: `docs/RELEASE_RC_EVIDENCE_2026-05-20.md`
- Real installer upgrade artifact: `output/playwright/installer-upgrade-smoke-2026-05-24.json`
- Upgrade-boundary backup artifact: `output/playwright/installer-upgrade-backup-2026-05-24.json`
- Browser workspace smoke artifact: `output/playwright/browser-workspace-smoke-2026-05-24.json`
- Packaged desktop smoke artifact: `output/playwright/packaged-desktop-smoke-2026-05-24.json`
- Packaged desktop backup artifact: `output/playwright/packaged-desktop-backup-2026-05-24.json`
- Packaged relaunch retention fix: `output/playwright/packaged-retention-fixed-2026-05-24.json`
- Historical compatibility boundary: `output/playwright/cross-version-compatibility-2026-05-24.json`

## Stop Condition

Do not close this handoff until all of the following are true:

- Batch 1 installer-version upgrade evidence remains traceable and uncontested
- the Batch 2 verification-stack contract remains traceable and rerunnable from source control
- `docs/RELEASE_RC_EVIDENCE_2026-05-23.md` and `docs/NEXT_EXECUTION_PLAN.md` reflect the latest active lane and blocker state
- public distribution is either still explicitly blocked or fully assigned with documented release infrastructure ownership
