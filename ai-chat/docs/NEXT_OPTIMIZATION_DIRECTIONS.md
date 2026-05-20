# AI Chat Next Optimization Directions

This document records candidate optimization directions for the next execution cycle. It is intentionally planning-only: each direction should become a bounded implementation task before code changes begin.

## Baseline

The first upgrade pass already established a working Next.js + Electron chat application with provider presets, prompt templates, conversation persistence, attachment gating, stream parsing, regenerate/edit-resend, Electron IPC, and a repository-local verification script.

The next optimization cycle should improve day-to-day usability, reliability, maintainability, and release readiness without breaking the current chat path.

## Direction 1: Chat Workflow Ergonomics

Goal: make repeated chat work faster and less error-prone.

Candidate improvements:

- Add conversation search and filtering in the sidebar.
- Add explicit conversation rename instead of title-only auto-generation.
- Add bulk cleanup paths for stale conversations and drafts.
- Add keyboard-focused navigation for sidebar, template picker, and message actions.
- Improve mobile and narrow-window layout behavior for the sidebar, settings, and long messages.

Acceptance signals:

- Users can locate an old conversation without scanning the full sidebar.
- Users can rename or organize conversations without editing stored data manually.
- No text, controls, or modal content overflow at narrow desktop/mobile widths.
- Existing send, stop, regenerate, edit-resend, draft, and attachment flows continue to work.

Primary touchpoints:

- `src/components/ChatBox.tsx`
- `src/components/InputArea.tsx`
- `src/components/MessageList.tsx`
- `src/components/MessageBubble.tsx`
- `src/app/globals.css`

## Direction 2: Persistence And Data Model Hardening

Goal: reduce localStorage fragility and make future data migrations safe.

Candidate improvements:

- Add explicit storage versioning for conversations, drafts, prompt templates, and provider presets.
- Validate stored records before use and quarantine malformed records instead of dropping them silently.
- Add import/export for conversations and prompts.
- Add storage-size guardrails and user-facing recovery for corrupted local data.
- Decide whether the next storage layer remains `localStorage`, moves to IndexedDB, or uses Electron userData files behind IPC.

Acceptance signals:

- Existing stored data migrates forward without data loss.
- Corrupted or old records do not crash the UI.
- Users can export and re-import conversations/templates.
- Web mode and Electron mode have an explicit, documented storage behavior.

Primary touchpoints:

- `src/components/ChatBox.tsx`
- `src/types/chat.ts`
- `electron/main.js`
- `electron/preload.js`
- `src/types/electron.d.ts`

## Direction 3: Provider And Model Configuration

Goal: make provider switching safer, clearer, and easier to verify.

Candidate improvements:

- Add preset validation before saving provider URL/model settings.
- Add a non-streaming or lightweight provider connectivity check.
- Surface active provider/model in the main UI without exposing secrets.
- Support capability metadata beyond `supportsAttachments`, such as vision support, max attachment size, and stream support.
- Consider per-conversation provider metadata so old conversations remain understandable after switching models.

Acceptance signals:

- Invalid provider URLs are rejected before a request is sent.
- Users can verify a preset without sending a full chat prompt.
- Errors are sanitized and actionable.
- Existing environment-default behavior remains intact.

Primary touchpoints:

- `src/server/ai/config.ts`
- `src/server/ai/openai-compatible.ts`
- `src/app/api/chat/route.ts`
- `src/components/ChatBox.tsx`
- `src/types/chat.ts`

## Direction 4: Streaming Reliability And Error Recovery

Goal: make long or interrupted AI responses more robust.

Candidate improvements:

- Extract stream parsing into a testable pure module.
- Add retry/reconnect decisions for upstream failures that happen before streaming starts.
- Add clearer incomplete-response state when `[DONE]` is missing.
- Preserve partial assistant output with explicit status when a user aborts or the stream fails.
- Add timeout behavior for hung upstream responses.

Acceptance signals:

- Stream parsing has targeted tests for chunk boundaries, invalid JSON, `[DONE]`, and partial data.
- User abort and upstream failure produce different UI states.
- Partial content is never silently lost.
- No secrets or local paths leak into displayed errors.

Primary touchpoints:

- `src/hooks/useChat.ts`
- `src/server/ai/openai-compatible.ts`
- `src/app/api/chat/route.ts`
- `scripts/verify-upgrade.mjs` or future test files

## Direction 5: Electron Desktop Polish

Goal: turn the desktop wrapper into a dependable app shell.

Candidate improvements:

- Add a small app-info/about surface using the existing preload bridge.
- Add safe log-open/export actions without exposing secrets.
- Add first-run diagnostics for missing API key, invalid provider URL, and failed embedded Next server startup.
- Add graceful handling for embedded server shutdown and relaunch.
- Plan auto-update only after release channel, signing, and rollback strategy are known.

Acceptance signals:

- Desktop users can identify version/platform and get useful diagnostics.
- Main-process logs stay sanitized.
- Electron startup failures are visible and recoverable.
- Web mode continues to work independently.

Primary touchpoints:

- `electron/main.js`
- `electron/preload.js`
- `src/types/electron.d.ts`
- `src/components/ChatBox.tsx`
- `package.json`

## Direction 6: Verification Coverage

Goal: move from regex contract checks toward behavior-level confidence.

Candidate improvements:

- Keep `scripts/verify-upgrade.mjs` as a fast guard, but stop treating it as a substitute for behavior tests.
- Add pure unit tests for provider config, error sanitization, stream parsing, and storage migration logic.
- Add component or browser checks for draft persistence, template insertion, conversation switching, and settings.
- Add Electron smoke verification for preload availability and startup path.
- Decide explicitly whether to introduce a test dependency. If yes, record the tradeoff before implementation.

Acceptance signals:

- The next plan names the smallest useful test layer before code changes.
- Critical behavior is verified by execution, not only text matching.
- CI/release checks can run with one documented command set.

Primary touchpoints:

- `scripts/verify-upgrade.mjs`
- `package.json`
- future test files

## Prioritization

Recommended order for the next execution cycle:

1. Extract testable boundaries and storage contracts before adding more UI features.
2. Improve chat workflow ergonomics once the data migration path is safe.
3. Add provider validation and stream reliability in the same phase, because both affect request failure handling.
4. Add Electron diagnostics after Web-mode behavior is stable.
5. Defer auto-update until release infrastructure exists.

