# AI Chat Next Optimization Directions

This document records the candidate optimization directions after the completed reliability, provider, desktop-hardening, and data portability batches. It is planning-only and should be refreshed whenever a direction moves from backlog into executed work.

## Current Baseline

The current app already includes:

- conversation persistence, drafts, and prompt templates,
- conversation pin/archive controls plus an archived-view filter,
- keyboard shortcuts for search and new-chat flow,
- versioned local backup export and strict replace-only restore for app-owned data,
- local-storage health warnings and recovery hints for quarantined records,
- provider presets with validation and connectivity checks,
- provider capability metadata and stored reachability status,
- per-conversation provider snapshots,
- extracted streaming and storage helpers,
- sanitized Electron diagnostics and log export/open actions,
- a contract verification script in `scripts/verify-upgrade.mjs`,
- dated packaged relaunch retention evidence for unpacked and installed executables.

The next optimization cycle should stop treating the completed reliability work as backlog and instead focus on what still limits safe iteration.

## Current Release Gap

Fresh 2026-05-24 evidence now exists for:

- the full static gate,
- packaging via `pnpm electron-build` and `pnpm electron-installer`,
- browser workspace smoke via `pnpm smoke:browser`,
- rerunnable packaged desktop smoke via `pnpm smoke:packaged`,
- unpacked About/startup diagnostics/log export/open plus current-run backup export/restore,
- installed startup/About/log export/open,
- historical local-data compatibility via the equivalent worktree artifact at `faccc58`,
- packaged relaunch retention after the stable packaged localhost-origin fix,
- the real `1.0.0 -> 1.0.1` installer-version upgrade path.

The current release gap is no longer repo-local validation. The remaining release lane is public distribution infrastructure:

- `pnpm verify:release` now captures the standing static, packaging, browser-smoke, and packaged-smoke contract,
- browser `localStorage` remains the current canonical store and now has dated browser, packaged relaunch, and installer-upgrade evidence for the current build,
- public distribution is still blocked by external signing, update, rollback, and trust-policy prerequisites.

## Direction 1: Maintainability And Verification Foundation (Completed 2026-05-20)

Outcome delivered in the current baseline:

- `ChatBox.tsx` was decomposed into sidebar, provider, template, rename, and About modal surfaces.
- `useChat.ts` now leans on stable helper boundaries for client submission work.
- `pnpm test` runs built-in Node behavior tests for storage, streaming, and provider config before the contract checker.
- No new package dependencies were introduced.

Future follow-ups for this area:

- keep behavior-level verification expanding with new feature work,
- preserve the extracted UI boundaries instead of collapsing behavior back into `ChatBox.tsx`,
- revisit browser or Electron automation only when dependency or workflow tradeoffs are explicit.

## Direction 2: Data Portability And Recovery (Completed 2026-05-20)

Outcome delivered in the current baseline:

- Users can export a versioned JSON backup for the app-owned `localStorage` boundary.
- Restore is explicit, replace-only, and rejects invalid backups with zero mutation.
- Mid-restore write failures roll back to the pre-restore snapshot.
- Web mode and Electron mode now share a documented portability contract without changing canonical storage.

Future follow-ups for this area:

- encrypted backups or scheduled backups,
- explicit installer upgrade compatibility testing across releases,
- a later revisit of whether `localStorage` should stay canonical long term.

## Direction 3: Release Readiness (Completed repo-local verification lane on 2026-05-24; public-release blocker remains)

Goal: move from local packaging success to an internal RC evidence lane with explicit public-release blockers.

Outcome delivered in the current baseline:

- 2026-05-20 internal RC baseline evidence remains preserved.
- 2026-05-23 reran static verification and installer packaging after the roadmap batch.
- 2026-05-24 added packaged relaunch retention evidence after the stable-origin fix.
- 2026-05-24 closed the real installer-version upgrade gap with dated artifacts.
- 2026-05-24 added source-controlled browser and packaged smoke commands plus `pnpm verify:release`.
- release evidence is now explicitly classified as `already evidenced`, `freshly rerun`, `deferred`, or blocked gate states.
- public distribution remains blocked by signing, update-channel, rollback, and trust-policy prerequisites.

Candidate improvements:

- preserve the rerunnable smoke contract and refresh evidence whenever release-sensitive behavior changes,
- decide signing ownership and secret storage before enabling public installers,
- define stable/beta/rollback update channels before any auto-update work.

Acceptance signals:

- Release steps are reproducible.
- Installer packaging and packaged retention evidence stay traceable to dated records.
- Auto-update remains deferred until the required infra exists.
- Public distribution remains blocked until signing and update prerequisites exist.

## Direction 4: UX Depth After Structure Stabilizes (Completed 2026-05-23)

Goal: keep improving repeated chat workflows after the maintainability foundation is in place.

Outcome delivered in the current baseline:

- conversations can now be pinned and archived,
- the sidebar supports archived/inbox switching with clearer empty states,
- `Ctrl/Cmd+K` focuses conversation search and `Alt+N` starts a new chat,
- recovery hints surface when local records were previously quarantined.

## Direction 5: Backup Enhancements And Local Data Strategy (Completed 2026-05-23 baseline pass)

Outcome delivered in the current baseline:

- the app now shows a soft-limit warning when app-owned local data grows large,
- About now explains the current local-data strategy and replace-only restore contract,
- roadmap docs now state that `localStorage` remains the canonical baseline and now has packaged-production evidence for a stable relaunch origin.

Future follow-ups:

- encrypted backups or scheduled backups,
- a stronger storage dashboard if large datasets become common,
- migration to a desktop-owned store only when local-first ergonomics clearly require it.

## Direction 6: Public Distribution Infrastructure (Blocked outside repo-only execution)

Current status:

- unsigned installers are still internal-only,
- update channels and rollback metadata hosting are still undefined,
- trust-policy and signing ownership are still external prerequisites.
- the current owner and metadata-hosting contract now lives in `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md`.

## Prioritization

Recommended order from the current baseline:

1. Preserve the `pnpm verify:release` contract and keep release docs aligned when release-sensitive behavior changes.
2. Resolve external ownership decisions for signing, update metadata, rollback, and public trust policy.
3. Revisit longer-horizon UX/storage follow-ups only after the public distribution boundary is explicit.
