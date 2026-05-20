# AI Chat Next Optimization Directions

This document records the candidate optimization directions after the completed reliability, provider, and desktop-hardening batch. It is planning-only and should be refreshed whenever a direction moves from backlog into executed work.

## Current Baseline

The current app already includes:

- conversation persistence, drafts, and prompt templates,
- provider presets with validation and connectivity checks,
- per-conversation provider snapshots,
- extracted streaming and storage helpers,
- sanitized Electron diagnostics and log export/open actions,
- a contract verification script in `scripts/verify-upgrade.mjs`.

The next optimization cycle should stop treating these as backlog items and instead focus on what still limits safe iteration.

## Direction 1: Maintainability And Verification Foundation

Goal: reduce change cost in the chat shell and move verification toward executable behavior-level checks without adding dependencies.

Candidate improvements:

- Extract `ChatBox.tsx` by UI surface so sidebar, provider settings, template editor, rename dialog, and About/diagnostics are not rendered inline in one file.
- Trim `useChat.ts` by moving client submission, attachment encoding, and error-sanitization helpers behind stable module boundaries.
- Add built-in Node behavior tests for `src/lib/streaming.ts`, `src/lib/storage.ts`, and `src/server/ai/config.ts`.
- Keep `scripts/verify-upgrade.mjs` as a contract guard, but stop using it as the only `pnpm test` gate.
- Update planning docs so future sessions do not keep re-planning already-completed reliability work.

Acceptance signals:

- `ChatBox.tsx` is materially smaller and coordinates behavior instead of inlining every modal/sidebar surface.
- Existing chat, provider, template, and diagnostics behavior still works.
- `pnpm test` runs behavior-level checks before the contract checker.
- No new package dependencies are introduced.

Primary touchpoints:

- `src/components/ChatBox.tsx`
- `src/components/chatbox/*`
- `src/hooks/useChat.ts`
- `src/lib/chat-client.ts`
- `src/lib/storage.ts`
- `src/lib/streaming.ts`
- `src/server/ai/config.ts`
- `scripts/run-behavior-tests.mjs`
- `scripts/*.behavior.test.mjs`

## Direction 2: Data Portability And Recovery

Goal: make local data more durable and easier to move across reinstalls or machines.

Candidate improvements:

- Add conversation/template export and import.
- Add storage-size guardrails and user-facing recovery hints for corrupted local data.
- Decide whether browser `localStorage` remains the long-term store or whether Electron user data / IndexedDB should become the canonical persistence layer.
- Define explicit compatibility expectations for app upgrades and reinstalls.

Acceptance signals:

- Users can export and re-import important local data.
- Corrupted storage no longer forces silent data loss.
- Web mode and Electron mode have a documented storage boundary.

## Direction 3: Release Readiness

Goal: move from local packaging success to a repeatable desktop release lane.

Candidate improvements:

- Verify installer upgrade/reinstall behavior against retained user data.
- Decide signing ownership and secret storage before enabling public installers.
- Define stable/beta/rollback update channels before any auto-update work.
- Add scripted smoke checks around packaged desktop startup and diagnostics.

Acceptance signals:

- Release steps are reproducible.
- Upgrade/uninstall/reinstall behavior is documented and tested.
- Auto-update remains deferred until the required infra exists.

## Direction 4: UX Depth After Structure Stabilizes

Goal: keep improving repeated chat workflows after the maintainability foundation is in place.

Candidate improvements:

- Better narrow-layout ergonomics and empty/filter states.
- More keyboard affordances around conversation navigation and message actions.
- Better organization tools for larger conversation sets.
- Future message utilities such as pin/favorite/archive once current state ownership is cleaner.

Acceptance signals:

- UX work lands on clearer component boundaries instead of expanding a monolithic shell.
- Layout changes do not regress provider/template/draft behavior.

## Prioritization

Recommended order from the current baseline:

1. Maintainability and executable behavior-level verification.
2. Data portability and recovery.
3. Release readiness once external signing/update constraints are defined.
4. Broader UX depth on top of the smaller component boundaries.
