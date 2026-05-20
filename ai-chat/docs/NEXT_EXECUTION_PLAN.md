# AI Chat Next Execution Plan

This is the handoff plan for the next session. It combines the optimization directions in `docs/NEXT_OPTIMIZATION_DIRECTIONS.md` with the full roadmap in `docs/NEXT_UPGRADE_ROADMAP.md`.

## Stop Condition For This Plan

Do not start implementation from this file until the user explicitly asks for execution. This pass records the next work only.

When execution begins, stop only after:

- the selected phase is implemented,
- relevant docs are updated,
- verification commands have fresh results,
- known gaps are recorded,
- the worktree is ready for review or commit.

## RALPLAN-DR Summary

Principles:

- Preserve the working chat path.
- Make user data migrations explicit.
- Keep provider secrets outside UI storage and logs.
- Improve testable boundaries before feature expansion.
- Keep Electron IPC narrow and security defaults intact.

Decision drivers:

- User trust in conversations, drafts, settings, and partial AI output.
- Maintainable boundaries for a growing React/Electron codebase.
- Executable verification that catches real behavior regressions.

Viable options:

- Reliability-first: chosen for the next execution cycle because it lowers regression risk.
- UX-first: valuable, but should follow storage and stream hardening.
- Desktop-first: valuable, but should follow Web-mode reliability.

Invalidated alternatives:

- Auto-update-first is not viable yet because release channel, signing, and rollback infrastructure are not defined.
- Large all-in-one upgrade is not viable because it mixes storage, UI, provider, Electron, and verification risk.

## Recommended Next Session: Phase 1 Reliability Foundation

Target result:

Create stable, testable boundaries for stream parsing, local storage, provider validation, and error state handling.

Work items:

1. Extract stream parser logic from `src/hooks/useChat.ts` into a pure module.
2. Add storage schema/version helpers for conversations, drafts, prompt templates, and provider presets.
3. Add validation/migration for existing localStorage records.
4. Distinguish abort, incomplete stream, upstream error, and validation error states in the hook/UI contract.
5. Add provider preset validation before save and before send.
6. Extend verification coverage for the above behavior.
7. Update `docs/NEXT_UPGRADE_ROADMAP.md` or a new checklist with completion evidence.

Primary files:

- `src/hooks/useChat.ts`
- `src/types/chat.ts`
- `src/components/ChatBox.tsx`
- `src/server/ai/config.ts`
- `src/server/ai/openai-compatible.ts`
- `scripts/verify-upgrade.mjs`

Expected new files:

- `src/lib/streaming.ts` or equivalent pure parser module.
- `src/lib/storage.ts` or equivalent storage validation/migration module.
- Optional focused verification files if a test framework is approved.

Verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Manual smoke checks:

1. Load existing conversations and drafts.
2. Send a normal message.
3. Stop generation and confirm partial output state.
4. Force a missing API key or invalid provider URL and confirm sanitized error.
5. Reload and confirm conversation/draft/template/provider persistence.

## Recommended Execution Mode

Preferred direct handoff:

```text
$ralph Implement Phase 1 Reliability Foundation from ai-chat/docs/NEXT_EXECUTION_PLAN.md. Preserve existing behavior, add/extend verification, and stop after lint/typecheck/test/build evidence is recorded.
```

Preferred team handoff when parallel implementation is desired:

```text
$team Implement Phase 1 Reliability Foundation from ai-chat/docs/NEXT_EXECUTION_PLAN.md with separate lanes for storage migration, stream parser/error state, provider validation, and verification.
```

Goal-mode handoff:

```text
$ultragoal Execute the AI Chat Phase 1 Reliability Foundation from ai-chat/docs/NEXT_EXECUTION_PLAN.md with verification-gated checkpoints.
```

Use `$performance-goal` only if the next session is specifically about speed, memory, latency, stream throughput, or bundle/build performance. Use `$autoresearch-goal` only if the next session is research-first, such as selecting a test framework or studying official Next.js/Electron guidance before implementation.

## Team Staffing Guidance

For `$team`:

- Lane 1, executor: storage schemas, migration helpers, and ChatBox integration.
- Lane 2, executor: stream parser extraction and useChat error-state contract.
- Lane 3, executor: provider preset validation and sanitized error consistency.
- Lane 4, test-engineer: verification plan and tests/scripts for the changed behavior.
- Lane 5, code-reviewer or verifier: integration review after lanes merge.

Write scopes should stay separated until integration:

- Storage lane owns storage helper files and the ChatBox storage call sites.
- Stream lane owns parser helpers and `useChat`.
- Provider lane owns provider config/provider route validation paths.
- Verification lane owns scripts or test files plus documentation of commands.

## Team Verification Path

1. Each lane reports changed files, behavior claims, and targeted verification.
2. Integration owner runs:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

3. Verifier checks that:

- no API keys or local paths are exposed,
- existing stored data is migrated or tolerated,
- abort/incomplete/upstream-error states are distinct,
- provider preset validation happens before failed sends where possible,
- docs record remaining gaps.

## Phase 2 Backlog: Chat Workspace UX

Start only after Phase 1 is complete.

Work items:

- Conversation search/filter.
- Explicit conversation rename.
- Draft cleanup and stale conversation cleanup.
- Responsive sidebar/settings/message layout polish.
- Keyboard navigation pass.

Verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Manual checks should cover create, rename, search, switch, reload, delete, and narrow-window behavior.

## Phase 3 Backlog: Provider And Attachment Capability Layer

Start after Phase 1, or after Phase 2 if UX work is higher priority.

Work items:

- Provider connectivity check.
- Capability metadata beyond `supportsAttachments`.
- Per-conversation provider metadata.
- Clear UI display for active provider/model without secrets.

Verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Phase 4 Backlog: Desktop Diagnostics And Release Readiness

Start after Web-mode reliability is stable.

Work items:

- About/app-info panel.
- Sanitized log export/open action.
- Embedded Next startup diagnostics.
- Production launch smoke checks.
- Release checklist for signing, update channel, rollback, installer behavior.

Verification:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
```

## Phase 5 Backlog: Verification Upgrade

Start when the team is ready to decide on test dependencies.

Decision point:

- Keep dependency-free verification for now, or introduce a focused test framework.

If introducing dependencies, record:

- selected package,
- why it is needed,
- rejected alternatives,
- command changes,
- CI/release impact.

## Completion Definition For Any Future Execution Batch

A batch is complete only when:

- changed behavior has an acceptance check,
- changed files are documented,
- verification commands have fresh results,
- user-facing docs are updated when behavior changes,
- secrets and local paths remain sanitized,
- Electron security defaults remain intact,
- unresolved risks are recorded before handoff.

## Consensus Review Record

Planner verdict: APPROVE.

Rationale: the plan is right-sized for the current project state. The project already has broad user-facing features, so the next execution should reduce reliability risk before adding more feature surface.

Architect verdict: APPROVE.

Strongest objection: a UX-first pass could produce more visible value sooner, especially conversation search and rename. However, that would add more stateful behavior on top of storage, stream, and provider contracts that still need stronger boundaries.

Tradeoff tension: reliability-first work is less visible, but it lowers the cost and risk of the later UX and Electron phases.

Architect revision applied: Phase 1 is explicitly bounded to reliability foundation work, and UX/provider extras/desktop diagnostics remain backlog phases instead of being mixed into the first execution batch.

Critic verdict: APPROVE.

Quality checks:

- Options are explicit and fairly compared.
- The chosen sequence is tied to the repo baseline, not generic preference.
- Acceptance criteria are testable.
- Verification commands are concrete.
- Follow-up execution modes are named without starting implementation.

Remaining risk: the future execution pass still needs to decide whether behavior-level testing remains dependency-free or introduces a focused test framework. That decision should be made before adding broad UI or browser tests.
