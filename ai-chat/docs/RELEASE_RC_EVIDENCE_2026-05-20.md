# AI Chat Internal RC Evidence

Date: 2026-05-20

This evidence lane proves internal release-candidate readiness only. It does not approve public distribution.

## Record 1

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `n/a`
- New install state: `source build, test, and packaging artifacts generated`
- Command used: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Smoke result: all static gates passed; `pnpm test` reported `28` behavior tests plus `upgrade verification checks passed`
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Gate state: `STATIC PASS`
- Owner / prerequisite note: static contracts do not prove packaged runtime behavior

## Record 2

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\win-unpacked\AI Chat.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `unpacked artifact only`
- New install state: `unpacked app launched for 12s and created/updated user data at C:\Users\admin\AppData\Roaming\ai-chat`
- Command used: `pnpm electron-build`, then hidden launch of `dist\win-unpacked\AI Chat.exe`
- Smoke result: unpacked executable started successfully and stayed alive long enough to confirm boot
- Sanitized log path: `C:\Users\admin\AppData\Roaming\ai-chat\logs\main.log` directory exists, but export/open flow was not exercised in this smoke pass
- Backup file path: `not exercised in packaged UI smoke`
- Gate state: `DEFERRED`
- Owner / prerequisite note: interactive packaged checks for About, backup export/restore, and log export/open still need a manual pass

## Record 3

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.0.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `no installed executable present after cleanup`
- New install state: `silent install, launch, uninstall, reinstall, relaunch, and cleanup completed`
- Command used: `pnpm electron-installer`, installer `/S`, installed app launch, uninstaller `/S`, reinstall `/S`
- Smoke result: installed app relaunched successfully from `C:\Users\admin\AppData\Local\Programs\ai-chat\AI Chat.exe`; cleanup removed the installed exe and preserved user data at `C:\Users\admin\AppData\Roaming\ai-chat`
- Sanitized log path: `not exercised through installed UI`
- Backup file path: `not exercised through installed UI`
- Gate state: `INSTALLER SMOKE PASS`
- Owner / prerequisite note: same-version install/reinstall/uninstall evidence is recorded; cross-version upgrade retention is still a separate deferred check

## Record 4

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.0.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `same-version reinstall only`
- New install state: `cross-version upgrade path not exercised`
- Command used: `n/a`
- Smoke result: retained user-data directory survived uninstall/reinstall, but no old-version to new-version upgrade was run in this session
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Gate state: `DEFERRED`
- Owner / prerequisite note: capture old-version to new-version upgrade evidence before any public release decision

## Record 5

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.0.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `unsigned local installer`
- New install state: `still unsigned`
- Command used: `pnpm electron-installer`
- Smoke result: installer was built successfully, but signing was skipped because no signing info exists
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Gate state: `BLOCKED`
- Owner / prerequisite note: public distribution remains blocked until certificate ownership, timestamp server, and secret storage are defined

## Record 6

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.0.exe.blockmap`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `auto-update disabled`
- New install state: `auto-update still disabled`
- Command used: `pnpm electron-installer`
- Smoke result: installer blockmap was produced, but no stable/beta/rollback channel or release metadata host exists
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Gate state: `DEFERRED`
- Owner / prerequisite note: define channels, rollback metadata hosting, and public trust policy before enabling update distribution
