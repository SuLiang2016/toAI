# AI Chat Internal RC Evidence

Date: 2026-05-23
Last updated: 2026-05-24

This evidence lane preserves the completed 2026-05-20 internal RC baseline, the completed 2026-05-23 roadmap Phase 1-6 batch, and the 2026-05-24 validation follow-up plus Batch 2 smoke-contract refresh. Earlier dated evidence that was not rerun in the current lane remains already evidenced rather than reopened as backlog. Any unresolved external release prerequisites remain explicit `DEFERRED` or `BLOCKED` gaps instead of implied passes. It does not approve public distribution.

## Record 1

- App version: `1.0.1`
- Artifact path: `C:\suliang\toAI\ai-chat`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `2026-05-23 static and packaging evidence already recorded`
- New install state: `full verification gate rerun on 2026-05-24 before packaged smoke and compatibility checks`
- Command used: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Smoke result: `pnpm test` reported `31` behavior tests plus `upgrade verification checks passed`; `pnpm build` completed with `/`, `/api/chat`, and `/api/provider/check`
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Evidence mode: `freshly rerun`
- Gate state: `STATIC PASS`
- Owner / prerequisite note: static verification still does not prove retained packaged data across relaunch

## Record 2

- App version: `1.0.1`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\win-unpacked\AI Chat.exe`, `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.1.exe`, `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.1.exe.blockmap`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `2026-05-23 packaging evidence already recorded`
- New install state: `unpacked and installer artifacts rebuilt on 2026-05-24`
- Command used: `pnpm electron-build`, `pnpm electron-installer`
- Smoke result: unpacked executable, installer, and blockmap were regenerated successfully; signing was skipped because no signing info exists
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Evidence mode: `freshly rerun`
- Gate state: `STATIC PASS`
- Owner / prerequisite note: packaging success alone does not prove startup retention or public release readiness

## Record 3

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\win-unpacked\AI Chat.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `2026-05-20 unpacked launch evidence already recorded`
- New install state: `2026-05-24 unpacked interactive smoke rerun through CDP automation against the packaged app`
- Command used: `dist\win-unpacked\AI Chat.exe --remote-debugging-port=9222`, plus automation captured in `C:\suliang\toAI\ai-chat\output\playwright\packaged-smoke-unpacked-startup-2026-05-24.json`
- Smoke result: About rendered app metadata and startup diagnostics after hydration; sanitized log export/open succeeded at `C:\Users\admin\AppData\Roaming\ai-chat\sanitized-main.log`; current-run backup export/restore completed and wrote `C:\suliang\toAI\ai-chat\output\playwright\packaged-smoke-unpacked-backup-2026-05-24.json`
- Sanitized log path: `C:\Users\admin\AppData\Roaming\ai-chat\sanitized-main.log`
- Backup file path: `C:\suliang\toAI\ai-chat\output\playwright\packaged-smoke-unpacked-backup-2026-05-24.json`
- Evidence mode: `freshly rerun`
- Gate state: `UNPACKED SMOKE PASS`
- Owner / prerequisite note: this proves same-run packaged About/diagnostics/log/backup actions only; packaged relaunch retention now has separate pass evidence in Record 6

## Record 4

- App version: `1.0.0`
- Artifact path: `C:\Users\admin\AppData\Local\Programs\ai-chat\AI Chat.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `2026-05-20 same-version install/reinstall/uninstall evidence remains preserved as baseline`
- New install state: `2026-05-24 silent install completed and installed app startup smoke reran`
- Command used: `dist\AI Chat Setup 1.0.0.exe /S`, then `C:\Users\admin\AppData\Local\Programs\ai-chat\AI Chat.exe --remote-debugging-port=9224`, with summary at `C:\suliang\toAI\ai-chat\output\playwright\packaged-smoke-installed-startup-2026-05-24.json`
- Smoke result: installed app launched successfully; About, startup diagnostics, sanitized log export, and sanitized log open all succeeded against the installed executable
- Sanitized log path: `C:\Users\admin\AppData\Roaming\ai-chat\sanitized-main.log`
- Backup file path: `n/a`
- Evidence mode: `freshly rerun`
- Gate state: `INSTALLER SMOKE PASS`
- Owner / prerequisite note: installed startup works, and packaged relaunch retention now has separate pass evidence in Record 6; real installer-version upgrade evidence is still separate work

## Record 5

- App version: `1.0.0`
- Artifact path: `C:\suliang\ai-chat-old\ai-chat`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `historical equivalent artifact at commit faccc58`
- New install state: `current build consumed historical local data and current backup restore contract`
- Command used: custom compatibility script; artifact summary at `C:\suliang\toAI\ai-chat\output\playwright\cross-version-compatibility-2026-05-24.json`
- Smoke result: current code loaded historical conversation records, provider presets, and provider snapshots; current backup export/restore completed after migration; unrelated local window state remained intact
- Sanitized log path: `n/a`
- Backup file path: `C:\suliang\toAI\ai-chat\output\playwright\packaged-smoke-unpacked-backup-2026-05-24.json`
- Evidence mode: `freshly rerun`
- Gate state: `STATIC PASS`
- Owner / prerequisite note: the historical build predates backup export/restore UI, so this proves historical local-data compatibility and current backup restore only, not installer-version metadata behavior

## Record 6

- App version: `1.0.0`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\win-unpacked\AI Chat.exe`, `C:\Users\admin\AppData\Local\Programs\ai-chat\AI Chat.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `prior relaunch blocker under the ephemeral localhost origin remains preserved in C:\suliang\toAI\ai-chat\output\playwright\packaged-retention-repro-2026-05-24.json`
- New install state: `fixed packaged build relaunched under a stable localhost origin and retained browser localStorage across relaunch for unpacked and installed executables`
- Command used: `dist\AI Chat Setup 1.0.0.exe /S`, `dist\win-unpacked\AI Chat.exe --remote-debugging-port=9333`, and `C:\Users\admin\AppData\Local\Programs\ai-chat\AI Chat.exe --remote-debugging-port=9334`, with summary at `C:\suliang\toAI\ai-chat\output\playwright\packaged-retention-fixed-2026-05-24.json`
- Smoke result: unpacked and installed first/second launches both loaded `http://127.0.0.1:38733/`; probe values written to browser localStorage were still present after relaunch in both packaged executables, so the packaged storage boundary is stable for the current build
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Evidence mode: `freshly rerun`
- Gate state: `PACKAGED RETENTION PASS`
- Owner / prerequisite note: `electron/main.js` now binds packaged production to a stable deterministic localhost origin, which resolves the relaunch-retention blocker for current packaged builds; a real installer-version upgrade path is still separate evidence work

## Record 7

- App version: `1.0.1`
- Artifact path: `C:\suliang\toAI\ai-chat\dist\AI Chat Setup 1.0.1.exe`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `unsigned local installer`
- New install state: `still unsigned after 2026-05-24 rebuild`
- Command used: `pnpm electron-installer`
- Smoke result: installer built successfully and signing was skipped because no signing info exists
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Evidence mode: `freshly rerun`
- Gate state: `BLOCKED`
- Owner / prerequisite note: public distribution remains blocked until certificate ownership, timestamp server, update metadata hosting, rollback policy, and trust-policy ownership are defined; see `docs/PUBLIC_DISTRIBUTION_OWNERSHIP.md`

## Record 8

- App version: `1.0.1`
- Artifact path: `C:\suliang\toAI\ai-chat\output\playwright\installer-upgrade-smoke-2026-05-24.json`, `C:\suliang\toAI\ai-chat\output\playwright\installer-upgrade-backup-2026-05-24.json`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `real packaged 1.0.0 installer from C:\suliang\ai-chat-old\ai-chat\dist\AI Chat Setup 1.0.0.exe with seeded conversation, provider preset, and draft state`
- New install state: `silent upgrade to 1.0.1 completed and current installed app migrated legacy localhost-origin data into the stable packaged origin`
- Command used: `node scripts/installer-upgrade-smoke.mjs`
- Smoke result: real `1.0.0 -> 1.0.1` installer upgrade preserved the seeded conversation, active provider preset, and draft; legacy origin `http://127.0.0.1:58160` was detected and migrated; About reported `Version: 1.0.1`; backup export completed at `2026-05-24T12:20:08.297Z`; restore verification passed and the original userData directory was restored after the run
- Sanitized log path: `n/a`
- Backup file path: `C:\suliang\toAI\ai-chat\output\playwright\installer-upgrade-backup-2026-05-24.json`
- Evidence mode: `freshly rerun`
- Gate state: `INSTALLER UPGRADE PASS`
- Owner / prerequisite note: this closes the remaining repo-local release-confidence gap for a real installer-version upgrade path; public distribution remains separately blocked by Record 7

## Record 9

- App version: `1.0.1`
- Artifact path: `C:\suliang\toAI\ai-chat\output\playwright\browser-workspace-smoke-2026-05-24.json`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `Batch 1 installer-version upgrade evidence and static/package gates already closed on 2026-05-24`
- New install state: `built browser app shell reran through system Chromium CDP automation against pnpm start`
- Command used: `node scripts/browser-workspace-smoke.mjs`
- Smoke result: seeded browser workspace state loaded successfully; conversation rename, search filtering, archive-view toggle, and new-chat draft persistence after reload all passed in the current app shell
- Sanitized log path: `n/a`
- Backup file path: `n/a`
- Evidence mode: `freshly rerun`
- Gate state: `BROWSER SMOKE PASS`
- Owner / prerequisite note: this is the standing repo-local browser workspace contract behind `pnpm smoke:browser`; it replaces operator-memory browser steps with a rerunnable command

## Record 10

- App version: `1.0.1`
- Artifact path: `C:\suliang\toAI\ai-chat\output\playwright\packaged-desktop-smoke-2026-05-24.json`, `C:\suliang\toAI\ai-chat\output\playwright\packaged-desktop-backup-2026-05-24.json`
- OS/profile: `Windows 10 19045 / admin`
- Old install state: `2026-05-24 unpacked packaging artifacts already rebuilt and installer/upgrade evidence already recorded`
- New install state: `current unpacked Electron build reran through remote debugging with isolated userData backup and restore`
- Command used: `node scripts/packaged-desktop-smoke.mjs`
- Smoke result: unpacked executable launched successfully; About loaded `Version: 1.0.1`, platform, log path, and startup diagnostics; sanitized log export succeeded; backup export status was emitted; restore verification passed from the generated backup JSON; the original userData directory was restored after the run
- Sanitized log path: `C:\Users\admin\AppData\Roaming\ai-chat\sanitized-main.log`
- Backup file path: `C:\suliang\toAI\ai-chat\output\playwright\packaged-desktop-backup-2026-05-24.json`
- Evidence mode: `freshly rerun`
- Gate state: `PACKAGED SMOKE PASS`
- Owner / prerequisite note: together with Record 9 and `pnpm verify:release`, this closes the Batch 2 verification-contract lane; installed startup and real installer-version upgrade evidence remain preserved in Records 4 and 8 while public distribution stays blocked by Record 7
