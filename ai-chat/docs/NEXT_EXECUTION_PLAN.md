# AI Chat Next Execution Plan

This file tracks the currently approved execution lane. Update it when the team finishes a batch or deliberately changes direction.

## Current Execution Lane

Maintainability and verification foundation.

## Target Result

- Reduce orchestration complexity in the main chat shell.
- Preserve existing chat/provider/template/diagnostics behavior.
- Make `pnpm test` run executable behavior-level checks in addition to the contract checker.
- Refresh planning docs so future work starts from the real current baseline.

## Work Items

1. Extract `ChatBox.tsx` by UI surface.
2. Move reusable client chat helpers out of `useChat.ts`.
3. Add built-in Node behavior tests for streaming, storage, and provider config.
4. Keep `scripts/verify-upgrade.mjs` as a fast boundary check and update it to verify the new module boundaries.
5. Refresh roadmap/planning docs after the code and verification pass are stable.

## Required Verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Manual Smoke

1. Create a new conversation and send a message.
2. Stop generation and verify the UI recovers cleanly.
3. Rename, search, and delete a conversation.
4. Insert, edit, and delete a prompt template.
5. Save and activate a provider preset, then run connectivity check.
6. Open About and confirm diagnostics/log actions still render.
7. Reload and verify persistence still works.

## Stop Condition

Stop only when:

- extracted boundaries are in place,
- verification commands have fresh passing output,
- known gaps are recorded,
- docs reflect the new baseline instead of the pre-hardening plan.
