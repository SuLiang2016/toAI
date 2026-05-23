# AI Chat Next Upgrade Roadmap

This roadmap is the full next-stage upgrade direction for AI Chat. It starts from the completed MVP-plus baseline and plans the next mature-product pass.

## Product Direction

AI Chat should evolve from a local MVP chat shell into a reliable desktop-first AI workspace:

- Fast repeated conversation work.
- Safe local persistence and recoverable user data.
- Clear model/provider configuration.
- Robust streaming and error handling.
- Desktop diagnostics and release readiness.
- Verification that catches behavior regressions before packaging.

## Planning Principles

1. Preserve the working chat path before expanding scope.
2. Make data migrations explicit before changing stored shapes.
3. Keep provider secrets outside UI storage and logs.
4. Prefer small behavior seams that can be tested without starting the full app.
5. Treat Electron capabilities as narrow IPC contracts, not renderer-side Node access.

## Decision Drivers

1. User trust: conversations, drafts, settings, and partial AI output must not disappear silently.
2. Maintainability: large UI and hook files need clearer internal boundaries before more features accumulate.
3. Verification: the next upgrade should improve confidence with executable behavior checks, not only static assertions.

## Viable Upgrade Options

### Option A: Reliability-First Upgrade

Focus storage contracts, stream parsing, error states, provider validation, and tests before adding major user-facing features.

Pros:

- Lowest regression risk.
- Builds a stronger base for later UI and desktop work.
- Matches the current codebase, where many features already exist but test coverage is still lightweight.

Cons:

- Less immediately visible to end users.
- Requires discipline to avoid expanding into UI polish mid-phase.

### Option B: UX-First Upgrade

Focus conversation search, rename, sidebar organization, responsive polish, and visible provider status.

Pros:

- Quickly improves day-to-day use.
- Produces visible progress.
- Can be scoped to React components.

Cons:

- Risks adding more behavior on top of fragile storage and parsing boundaries.
- May increase the cost of later migrations.

### Option C: Desktop-First Upgrade

Focus Electron diagnostics, app info, log export, embedded server recovery, packaging, and release preparation.

Pros:

- Moves the product toward a serious desktop app.
- Improves supportability.
- Helps packaging and distribution decisions.

Cons:

- Depends on already-stable Web behavior.
- Auto-update and signing decisions may be blocked by missing release infrastructure.

## Chosen Roadmap

Choose Option A first, then fold selected UX and Electron work into later phases. The current project already has a broad feature surface; the highest leverage next step is to harden behavior boundaries and verification before expanding features.

## Phase 1: Reliability Foundation

Objective: isolate and verify the core behaviors that can break user trust.

Scope:

- Extract stream parsing from `useChat` into a pure helper.
- Define message/conversation/template/provider storage schemas and versioning.
- Add migration helpers for existing stored data.
- Standardize incomplete, aborted, and failed response states.
- Add provider preset validation before send/save.

Acceptance criteria:

- Existing conversations, drafts, templates, and provider presets still load.
- Malformed stored data does not crash the app.
- Stream parser behavior is covered for chunk boundaries, `[DONE]`, invalid JSON, and partial endings.
- Aborted generation and upstream failure show distinct states.
- Provider URL/model validation fails before a bad request is sent.

Suggested verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Implementation notes:

- Do not introduce a test framework unless the execution pass explicitly approves it.
- If staying dependency-free, extend `scripts/verify-upgrade.mjs` only where it remains readable; otherwise plan a dedicated test dependency decision.

## Phase 2: Chat Workspace UX

Objective: improve the daily chat workflow after storage behavior is safe.

Scope:

- Conversation search/filter.
- Explicit conversation rename.
- Draft and stale conversation cleanup.
- Better sidebar state for empty, loading, filtered, and narrow layouts.
- Message action affordances for copy, regenerate, edit-resend, and future pin/favorite work.

Acceptance criteria:

- Conversation search works across title and message preview.
- Rename persists and survives reload.
- Draft cleanup does not remove active unsent text by accident.
- Narrow-window layout has no overlapping controls or hidden critical actions.

Suggested verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Manual checks:

1. Create multiple conversations.
2. Rename one conversation.
3. Search by renamed title and message content.
4. Switch conversations with drafts present.
5. Reload and verify persistence.

## Phase 3: Provider And Attachment Capability Layer

Objective: make model/provider behavior explicit and safer.

Scope:

- Provider preset validation.
- Provider connectivity check endpoint or action.
- Capability metadata: attachments, vision, max file size, streaming.
- Per-conversation provider metadata for future traceability.
- Clear fallback rules between environment defaults and active presets.

Acceptance criteria:

- Users can check whether a preset is reachable without sending a full prompt.
- Active provider/model is visible without exposing API keys.
- Unsupported attachment paths fail before expensive upload/send behavior.
- Historical conversations remain understandable after changing active provider.

Suggested verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Phase 4: Desktop Diagnostics And Release Readiness

Objective: make Electron behavior supportable and prepare for internal RC evidence, not public distribution.

Scope:

- About/app-info panel using existing IPC.
- Sanitized log export/open action.
- Startup diagnostics for embedded Next server failures.
- Production launch smoke checks.
- Release checklist for signing, update channel, rollback, and installer behavior.
- Release evidence template with explicit gate states.

Acceptance criteria:

- Users can see app version and platform.
- Logs remain sanitized and do not include secrets.
- Failed embedded-server startup is recorded with a useful message.
- `pnpm electron-build` remains reproducible.
- Public distribution stays blocked until signing, update, and rollback prerequisites exist.

Suggested verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
pnpm electron-installer
```

## Phase 5: Verification Upgrade

Objective: establish the long-term quality gate.

Scope:

- Decide whether to keep dependency-free verification or add a test framework.
- Add behavior tests for storage migration, stream parser, provider config, and sanitization.
- Add browser-level checks for conversation, draft, template, and settings flows.
- Add Electron smoke verification for startup and preload.
- Document CI/release command sequence.

Acceptance criteria:

- The verification stack has a clear owner and command set.
- Behavior tests cover the core failure-prone paths.
- Release checks are documented and repeatable.
- Future upgrades do not depend on manual inspection alone.

## Execution Evidence

Execution date: 2026-05-19.

Phase 1 through Phase 5 were implemented as one dependency-ordered upgrade batch:

- Phase 1: stream parsing moved to `src/lib/streaming.ts`, storage schema/version helpers moved to `src/lib/storage.ts`, provider settings are validated before save/send, and chat errors distinguish abort, incomplete stream, upstream error, validation error, and network error.
- Phase 2: the chat workspace now has conversation search/filter, explicit rename, stale draft cleanup, provider display, and keyboard navigation in the conversation list.
- Phase 3: provider presets now carry capability metadata, active provider snapshots are stored per conversation, and `/api/provider/check` validates connectivity without sending a full chat prompt.
- Phase 4: the desktop shell exposes app info, startup diagnostics, sanitized log export, and sanitized log open actions through narrow preload IPC while preserving Electron security defaults; `docs/RELEASE_CHECKLIST.md` records signing, update-channel, rollback, installer, and release-command gates.
- Phase 5: dependency-free verification was kept intentionally; `scripts/verify-upgrade.mjs` now checks the new behavior contracts and release-readiness surface.

Verification command set:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
```

Fresh verification results:

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed with `upgrade verification checks passed`.
- `pnpm build`: passed; routes include `/`, `/api/chat`, and `/api/provider/check`.
- `pnpm electron-build`: passed; `dist/win-unpacked/AI Chat.exe` was produced.

Browser smoke evidence:

- Opened `http://localhost:3000/` with Playwright CLI.
- Created and sent a normal message; the conversation was created and the assistant response rendered.
- Renamed the conversation to `smoke renamed`, searched for `renamed`, and confirmed the renamed conversation filtered correctly.
- Reloaded the page and confirmed the renamed conversation and messages persisted from local storage.
- Entered an invalid provider URL and confirmed save-time validation displayed `Provider URL must be a valid HTTP URL.`
- Opened the About surface and confirmed the diagnostics/log actions render in Web mode without exposing secrets.
- Resized to `390x780` and captured a narrow viewport snapshot with no incoherent control overlap in the main chat path.

Known gaps:

- Provider connectivity checks require a valid local `AI_API_KEY` or `OPENAI_API_KEY` to prove reachability against a real provider.
- Electron runtime smoke beyond packaging remains manual because no new desktop automation dependency was introduced in this batch.

Execution date: 2026-05-20.

Maintainability and verification foundation batch:

- `ChatBox.tsx` was decomposed by UI surface into `src/components/chatbox/` boundaries for the sidebar, provider preset dialog, About dialog, template editor dialog, and rename dialog.
- `useChat.ts` moved reusable client submission helpers into `src/lib/chat-client.ts` so the hook focuses more on React state/ref orchestration.
- `pnpm test` now runs built-in Node behavior tests through `scripts/run-behavior-tests.mjs` before the existing contract checker, without adding dependencies.
- Behavior tests were added for `src/lib/streaming.ts`, `src/lib/storage.ts`, and `src/server/ai/config.ts`.
- `docs/NEXT_OPTIMIZATION_DIRECTIONS.md` and `docs/NEXT_EXECUTION_PLAN.md` were refreshed so they no longer describe already-completed reliability/provider/desktop work as future backlog.

Fresh verification results:

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed with 16 behavior tests plus `upgrade verification checks passed`.
- `pnpm build`: passed; routes include `/`, `/api/chat`, and `/api/provider/check`.

Known gaps after this batch:

- Manual smoke checks were not rerun inside this session because no browser automation pass was requested for the refactor-only UI extraction.
- `pnpm electron-build` was not rerun because this batch did not change Electron main/preload/build behavior.

Execution date: 2026-05-20.

Data portability and recovery batch:

- `src/lib/storage.ts` now owns a versioned backup envelope, strict backup validation, explicit backup-to-runtime key mapping, replace-only restore semantics, and rollback to a raw key snapshot if any restore write fails.
- `src/components/ChatBox.tsx` and `src/components/chatbox/AboutModal.tsx` now expose backup export and restore actions without widening Electron IPC; restore requires explicit confirmation and reloads the app after success.
- `scripts/storage.behavior.test.mjs` now covers deterministic export, valid replace-only restore, malformed or incompatible backup rejection with zero mutation, referential-integrity failures, and rollback after a simulated mid-restore write failure.
- `scripts/verify-upgrade.mjs` now treats the backup/restore contract and About-surface backup actions as part of the standing repo verification surface.
- `docs/NEXT_OPTIMIZATION_DIRECTIONS.md` and `docs/NEXT_EXECUTION_PLAN.md` were advanced so the repo no longer treats this portability batch as future work.

Fresh verification results:

- `pnpm test`: passed with 28 behavior tests plus `upgrade verification checks passed`.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; routes include `/`, `/api/chat`, and `/api/provider/check`.

Known gaps after this batch:

- Manual browser smoke for export/download and restore/file-pick flows was not rerun in this session.
- `pnpm electron-dev` was not rerun because the optional Electron backup dialog bridge was intentionally not implemented.
- `pnpm electron-build` was not rerun because this batch did not change Electron main/preload/build behavior or packaging paths.

Execution date: 2026-05-20.

Internal RC evidence batch:

- `docs/RELEASE_CHECKLIST.md` now names explicit gate states for static, unpacked, installer, blocked, and deferred outcomes instead of implying public release approval.
- `docs/RELEASE_EVIDENCE_TEMPLATE.md` now provides a compact evidence record format for static, unpacked, installer, and public-distribution gates.
- `docs/RELEASE_RC_EVIDENCE_2026-05-20.md` records fresh static evidence, unpacked launch evidence, same-version installer smoke, and explicit public-release blockers.
- `scripts/verify-upgrade.mjs` now keeps the release-language contract honest by asserting the internal-RC framing and evidence-template fields.

Fresh verification results:

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed with 28 behavior tests plus `upgrade verification checks passed`.
- `pnpm build`: passed; routes include `/`, `/api/chat`, and `/api/provider/check`.
- `pnpm electron-build`: passed; `dist/win-unpacked/AI Chat.exe` was produced.
- `pnpm electron-installer`: passed; `dist/AI Chat Setup 1.0.0.exe` and `.blockmap` were produced.

Smoke evidence:

- The unpacked app launched successfully and created/updated user data under `C:\Users\admin\AppData\Roaming\ai-chat`.
- The installed app launched successfully from `C:\Users\admin\AppData\Local\Programs\ai-chat\AI Chat.exe`.
- Silent uninstall removed the installed executable while keeping the user-data directory in place.
- Silent reinstall recreated the installed executable and launched successfully before cleanup.

Known gaps after this batch:

- Interactive packaged checks for About, backup export/restore, and log export/open remain deferred.
- Cross-version upgrade retention is still deferred; this session only proved same-version reinstall behavior.
- Public distribution remains blocked until signing ownership, timestamping, update channels, rollback metadata hosting, and trust policy are defined.

Execution date: 2026-05-23.

Roadmap Phase 1-6 completion batch:

- Phase 1 RC evidence delta closure: preserved the 2026-05-20 internal RC baseline, reran fresh static verification, rebuilt installer artifacts, and recorded the delta-closure evidence in `docs/RELEASE_RC_EVIDENCE_2026-05-23.md`.
- Phase 2 cross-version compatibility evidence: behavior tests now prove legacy conversation records, legacy provider presets, and legacy provider snapshots still normalize under the current runtime contract; installer-level old-version to new-version evidence remains a separate deferred path.
- Phase 3 UX depth: the sidebar now supports pin/archive organization, archived/inbox switching, clearer empty states, `Ctrl/Cmd+K` search focus, `Alt+N` new chat, and visible recovery hints when corrupted local records were previously quarantined.
- Phase 4 provider/model workflow depth: provider presets now store richer capability metadata, preserve last connectivity status, expose capability summaries in the settings modal, and drive dynamic attachment limits in the input area.
- Phase 5 backup enhancements and local data strategy: the app now surfaces local-storage soft-limit warnings, exposes a storage-health summary in About, and documents that `localStorage` remains canonical until a desktop-owned store is justified.
- Phase 6 public distribution infrastructure: public release remains intentionally blocked; the repo now preserves explicit blockers for signing ownership, timestamping, update-channel metadata, rollback hosting, and trust policy rather than implying those prerequisites were solved in code.

Fresh verification results:

- `pnpm test`: passed with 31 behavior tests plus `upgrade verification checks passed`.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; routes include `/`, `/api/chat`, and `/api/provider/check`.
- `pnpm electron-installer`: passed; packaging refreshed `dist/win-unpacked/AI Chat.exe`, `dist/AI Chat Setup 1.0.0.exe`, and `dist/AI Chat Setup 1.0.0.exe.blockmap`.

Known gaps after this batch:

- No fresh interactive packaged UI smoke was run in this session for About, backup export/restore, or sanitized log actions; the 2026-05-20 evidence remains the latest direct packaged-interaction record.
- Provider connectivity still requires a valid local `AI_API_KEY` or `OPENAI_API_KEY` for a real end-to-end reachability proof.
- Cross-version installer upgrade retention is still deferred until an older artifact is intentionally exercised against the current build.
- Public distribution remains blocked until external ownership exists for signing, update metadata, rollback policy, and trust policy.

## ADR

Decision: run the next upgrade as a reliability-first roadmap, then layer UX and Electron improvements after storage, stream, provider, and verification boundaries are stronger.

Drivers:

- Existing feature surface is already broad.
- User data and streaming behavior are the highest trust risks.
- Current verification is useful but not enough for behavior-heavy future changes.

Alternatives considered:

- UX-first: rejected as the first phase because it would add more stateful UI behavior before hardening storage and parsing.
- Desktop-first: rejected as the first phase because packaging and diagnostics depend on stable Web-mode behavior.
- Auto-update-first: rejected because release channel, signing, and rollback details are unknown.

Consequences:

- The next execution cycle may feel less visual at first.
- Later UX work should be easier because storage and state contracts will be clearer.
- Test strategy may need a separate dependency decision.

Follow-ups:

- Convert Phase 1 into an execution issue or `$ralph` task before implementation.
- Revisit test dependency choice before adding browser or component tests.
- Keep auto-update deferred until release infrastructure is available.

## Available Agent Types For Execution

- `explore`: map current code paths and storage/stream/provider dependencies.
- `executor`: implement bounded code changes.
- `test-engineer`: design and add verification coverage.
- `architect`: review boundaries, data contracts, and Electron IPC shape.
- `code-reviewer`: review final diffs for regressions and missing tests.
- `verifier`: validate completion evidence before handoff.

## Reasoning Guidance By Lane

- Reliability foundation: high reasoning for architecture and migration design; medium for implementation.
- UX improvements: medium reasoning for implementation; high for responsive/interaction review when layout changes are broad.
- Provider layer: high reasoning for error/security/capability contracts.
- Electron diagnostics: high reasoning for IPC and security boundaries; medium for UI wiring.
- Verification: high reasoning for test strategy; medium for focused test implementation.
