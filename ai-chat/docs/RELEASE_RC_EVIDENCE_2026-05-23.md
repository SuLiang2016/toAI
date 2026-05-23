# AI Chat Internal RC Evidence

Date: 2026-05-23

This evidence lane preserves the completed 2026-05-20 internal RC baseline while recording the 2026-05-23 roadmap delta closure. It does not approve public distribution.

## Record 1

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `2026-05-20 internal RC baseline already recorded`
- New install state: `static verification rerun after roadmap Phase 2-5 code and docs batch`
- Command used: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
- Smoke result: `31` behavior tests plus `upgrade verification checks passed`; production build includes `/`, `/api/chat`, and `/api/provider/check`
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Evidence mode: `freshly rerun`
- Gate state: `STATIC PASS`
- Owner / prerequisite note: static verification does not refresh packaged interactive UI evidence by itself

## Record 2

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\win-unpacked\AI Chat.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `2026-05-20 unpacked smoke already recorded`
- New install state: `packaging rerun as part of installer build; unpacked artifact present under dist\win-unpacked`
- Command used: `pnpm electron-installer`
- Smoke result: installer build repackaged the app and refreshed `dist\win-unpacked`; no new interactive unpacked-app launch was run in this session
- Sanitized log path: `already evidenced in 2026-05-20 record only`
- Backup file path: `already evidenced in 2026-05-20 record only`
- Evidence mode: `already evidenced`
- Gate state: `DEFERRED`
- Owner / prerequisite note: use the 2026-05-20 unpacked smoke record for packaged launch evidence until a fresh interactive pass is requested

## Record 3

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.0.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `2026-05-20 installer smoke already recorded`
- New install state: `installer rebuilt after roadmap Phase 2-5 code and docs batch`
- Command used: `pnpm electron-installer`
- Smoke result: installer build succeeded; `dist\AI Chat Setup 1.0.0.exe` and `.blockmap` were regenerated
- Sanitized log path: `already evidenced in 2026-05-20 record only`
- Backup file path: `already evidenced in 2026-05-20 record only`
- Evidence mode: `deferred`
- Gate state: `DEFERRED`
- Owner / prerequisite note: this rerun proves packaging completion only; use the 2026-05-20 installer smoke record until a fresh interactive installed-app launch is rerun

## Record 4

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.0.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `same-version reinstall evidence already recorded`
- New install state: `cross-version installer upgrade still not executed in this session`
- Command used: `n/a`
- Smoke result: cross-version retention remains a planned compatibility check, not a completed installer smoke path
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Evidence mode: `deferred`
- Gate state: `DEFERRED`
- Owner / prerequisite note: Phase 2 now has code-level legacy compatibility evidence, but full old-installer to new-installer upgrade evidence still needs a dedicated run

## Record 5

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.0.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `unsigned local installer`
- New install state: `still unsigned after rebuild`
- Command used: `pnpm electron-installer`
- Smoke result: installer built successfully and signing was skipped because no signing info exists
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Evidence mode: `freshly rerun`
- Gate state: `BLOCKED`
- Owner / prerequisite note: public distribution remains blocked until certificate ownership, timestamp server, update metadata hosting, rollback policy, and secret storage are defined
