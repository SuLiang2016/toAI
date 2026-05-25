import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BACKUP_FILE_INPUT_SELECTOR,
  clickButtonByText,
  closeChildProcess,
  connectToPage,
  ensureParentDir,
  getPnpmCommand,
  requestGracefulClose,
  sleep,
  taskkillImage,
  waitFor,
  waitForExpression,
  waitForExpressionValue,
  waitForUiReady,
  removeDirWithRetries,
} from './smoke-helpers.mjs';

const DEFAULT_OUTPUT_PATH = path.resolve('output/playwright/packaged-desktop-smoke-2026-05-24.json');
const DEFAULT_BACKUP_JSON_PATH = path.resolve('output/playwright/packaged-desktop-backup-2026-05-24.json');
const UNPACKED_EXE = path.resolve('dist/win-unpacked/AI Chat.exe');
const SMOKE_APPDATA_ROOT = process.env.AI_CHAT_SMOKE_APPDATA ?? path.resolve('output/playwright/appdata');
const USER_DATA_DIR = path.join(SMOKE_APPDATA_ROOT, 'ai-chat');
const APP_STORAGE_KEYS = [
  'conversations',
  'currentConversationId',
  'conversationDrafts',
  'newConversationDraft',
  'locale',
  'promptTemplates',
  'providerPresets',
  'activeProviderPresetId',
  'providerSettings',
];
const DEBUG_PORT = 9442;

function parseArgs(argv) {
  const options = {
    outputPath: DEFAULT_OUTPUT_PATH,
    backupJsonPath: DEFAULT_BACKUP_JSON_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];
    if (arg === '--output' && nextValue) {
      options.outputPath = path.resolve(nextValue);
      index += 1;
    } else if (arg === '--backup-json' && nextValue) {
      options.backupJsonPath = path.resolve(nextValue);
      index += 1;
    }
  }

  return options;
}

function createSeedState() {
  const conversationId = 'packaged-smoke-conversation-1';
  const providerId = 'packaged-smoke-provider-1';
  const now = Date.now();

  return {
    conversationId,
    providerId,
    conversationTitle: 'Packaged smoke seed conversation',
    localStorage: {
      conversations: [
        {
          id: conversationId,
          title: 'Packaged smoke seed conversation',
          createdAt: now - 10_000,
          updatedAt: now - 5_000,
          pinned: false,
          archived: false,
          provider: {
            id: providerId,
            name: 'Packaged Smoke Provider',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4.1-mini',
            checkedAt: now - 20_000,
            status: 'reachable',
            capabilities: {
              supportsAttachments: true,
              supportsImages: true,
              maxImageAttachmentBytes: 5 * 1024 * 1024,
              maxTextFileBytes: 256 * 1024,
              streaming: true,
            },
          },
          messages: [
            {
              id: 'packaged-smoke-user-1',
              role: 'user',
              content: 'Preserve this packaged smoke backup state',
              timestamp: now - 9_000,
              status: 'complete',
            },
            {
              id: 'packaged-smoke-assistant-1',
              role: 'assistant',
              content: 'Packaged desktop smoke state seeded',
              timestamp: now - 8_000,
              status: 'complete',
            },
          ],
        },
      ],
      currentConversationId: conversationId,
      locale: 'en',
      conversationDrafts: {
        [conversationId]: 'packaged draft survives restore',
      },
      newConversationDraft: '',
      promptTemplates: [
        {
          id: 'packaged-template-1',
          title: 'Packaged smoke template',
          content: 'Keep packaged smoke stable.',
          createdAt: now - 7_000,
          updatedAt: now - 7_000,
        },
      ],
      providerPresets: [
        {
          id: providerId,
          name: 'Packaged Smoke Provider',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4.1-mini',
          supportsAttachments: true,
          capabilities: {
            supportsAttachments: true,
            supportsImages: true,
            maxImageAttachmentBytes: 5 * 1024 * 1024,
            maxTextFileBytes: 256 * 1024,
            streaming: true,
          },
          createdAt: now - 6_000,
          updatedAt: now - 6_000,
          lastCheckedAt: now - 5_000,
          lastCheckStatus: 'reachable',
        },
      ],
      activeProviderPresetId: providerId,
      providerSettings: null,
    },
  };
}

function storageJsonExpression(seed) {
  const payload = JSON.stringify(seed.localStorage);
  return `
    (() => {
      const seed = ${payload};
      localStorage.setItem('conversations', JSON.stringify(seed.conversations));
      localStorage.setItem('currentConversationId', seed.currentConversationId);
      localStorage.setItem('locale', seed.locale);
      localStorage.setItem('conversationDrafts', JSON.stringify(seed.conversationDrafts));
      localStorage.setItem('newConversationDraft', seed.newConversationDraft);
      localStorage.setItem('promptTemplates', JSON.stringify(seed.promptTemplates));
      localStorage.setItem('providerPresets', JSON.stringify(seed.providerPresets));
      localStorage.setItem('activeProviderPresetId', seed.activeProviderPresetId);
      localStorage.removeItem('providerSettings');
      return true;
    })();
  `;
}

function captureStorageExpression() {
  return `
    (() => {
      const readJson = key => {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      };

      return {
        conversations: readJson('conversations'),
        currentConversationId: localStorage.getItem('currentConversationId'),
        locale: localStorage.getItem('locale'),
        conversationDrafts: readJson('conversationDrafts'),
        newConversationDraft: localStorage.getItem('newConversationDraft'),
        promptTemplates: readJson('promptTemplates'),
        providerPresets: readJson('providerPresets'),
        activeProviderPresetId: localStorage.getItem('activeProviderPresetId'),
      };
    })();
  `;
}

function buildBackupEnvelope(storageSnapshot, createdAt) {
  return {
    backupFormatVersion: 1,
    storageSchemaVersion: 2,
    createdAt,
    localStorage: {
      conversations: storageSnapshot.conversations ?? [],
      activeConversationId: storageSnapshot.currentConversationId ?? null,
      locale: storageSnapshot.locale ?? null,
      conversationDrafts: storageSnapshot.conversationDrafts ?? {},
      newConversationDraft: storageSnapshot.newConversationDraft ?? '',
      promptTemplates: storageSnapshot.promptTemplates ?? [],
      providerPresets: storageSnapshot.providerPresets ?? [],
      activeProviderPresetId: storageSnapshot.activeProviderPresetId ?? null,
      legacyProviderSettings: null,
    },
  };
}

async function waitForHeaderTitle(session, expectedTitle) {
  await waitForExpression(session, `
    (() => document.querySelector('header h1')?.textContent?.trim() === ${JSON.stringify(expectedTitle)})()
  `, `header title ${expectedTitle}`);
}

async function openAbout(session) {
  await waitForExpression(session, `
    (() => {
      const button = document.querySelector('button[aria-label="About"]');
      if (!button) {
        return false;
      }
      button.click();
      return true;
    })()
  `, 'About button click');

  await waitForExpression(session, `
    Boolean(document.querySelector('button[aria-label="Close about dialog"]'))
  `, 'About modal');
}

async function waitForStatusText(session, expectedText) {
  return waitForExpressionValue(session, `
    (() => {
      return [...document.querySelectorAll('p')]
        .map(node => node.textContent?.trim() || '')
        .find(text => text.includes(${JSON.stringify(expectedText)})) || null;
    })()
  `, `status containing ${expectedText}`);
}

async function waitForAboutDetails(session) {
  return waitFor(async () => {
    try {
      const details = await session.evaluate(`
        (() => {
          const lines = [...document.querySelectorAll('div')]
            .map(node => node.textContent?.trim() || '')
            .filter(Boolean);

          const versionLine = lines.find(text => text.startsWith('Version:')) || null;
          const platformLine = lines.find(text => text.startsWith('Platform:')) || null;
          const logPathLine = lines.find(text => text.startsWith('Log path:')) || null;
          const startupLine = lines.find(text => text.startsWith('Startup:')) || null;
          return { versionLine, platformLine, logPathLine, startupLine };
        })()
      `);

      if (
        details?.versionLine?.includes('Version: 1.0.1') &&
        details?.platformLine &&
        !details.platformLine.endsWith('Unavailable') &&
        details?.logPathLine &&
        !details.logPathLine.endsWith('Unavailable') &&
        details?.startupLine &&
        !details.startupLine.endsWith('Unavailable')
      ) {
        return details;
      }
    } catch {
      // Retry until About data hydrates.
    }

    return null;
  }, 'packaged About details', 20000, 500);
}

async function mutateStorageForRestoreCheck(session) {
  await session.evaluate(`
    (() => {
      ${APP_STORAGE_KEYS.map(key => `localStorage.removeItem(${JSON.stringify(key)});`).join('\n')}
      return true;
    })()
  `);
  await session.send('Page.reload', { ignoreCache: true });
  await waitForUiReady(session);
}

function launchPackagedApp() {
  return spawn(UNPACKED_EXE, [`--remote-debugging-port=${DEBUG_PORT}`], {
    detached: false,
    stdio: 'ignore',
    env: {
      ...process.env,
      APPDATA: SMOKE_APPDATA_ROOT,
    },
  });
}

function launchSourceElectronFallback() {
  const pnpm = getPnpmCommand();
  return process.platform === 'win32'
    ? spawn(
        'cmd.exe',
        ['/d', '/s', '/c', `${pnpm} exec electron --remote-debugging-port=${DEBUG_PORT} .`],
        {
          cwd: process.cwd(),
          detached: false,
          stdio: 'ignore',
          env: {
            ...process.env,
            NODE_ENV: 'production',
            APPDATA: SMOKE_APPDATA_ROOT,
          },
        }
      )
    : spawn(
        pnpm,
        ['exec', 'electron', `--remote-debugging-port=${DEBUG_PORT}`, '.'],
        {
          cwd: process.cwd(),
          detached: false,
          stdio: 'ignore',
          env: {
            ...process.env,
            NODE_ENV: 'production',
            APPDATA: SMOKE_APPDATA_ROOT,
          },
        }
      );
}

async function restoreUserDataWithRetries(backupPath) {
  let lastError = null;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      taskkillImage('AI Chat.exe');
      await sleep(1000 * attempt);
      if (existsSync(USER_DATA_DIR)) {
        await removeDirWithRetries(USER_DATA_DIR);
      }
      await rename(backupPath, USER_DATA_DIR);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seed = createSeedState();
  const summary = {
    ranAt: new Date().toISOString(),
    outputPath: options.outputPath,
    backupJsonPath: options.backupJsonPath,
    unpackedExecutable: UNPACKED_EXE,
    appDataRoot: SMOKE_APPDATA_ROOT,
    launchMode: 'packaged',
    originalUserDataPresent: existsSync(USER_DATA_DIR),
    userDataBackupPath: null,
    aboutDetails: null,
    logExportStatus: null,
    backupExportStatus: null,
    restoreStatus: null,
    backupFileExists: false,
    sanitizedLogPath: null,
    restoreVerified: false,
    localeVerified: false,
    restoredOriginalUserData: false,
  };

  if (!existsSync(UNPACKED_EXE)) {
    throw new Error('Packaged smoke requires dist/win-unpacked/AI Chat.exe. Run pnpm electron-build first.');
  }

  let appChild = null;
  let session = null;
  const userDataBackupPath = `${USER_DATA_DIR}.batch2-backup-${Date.now()}`;

  try {
    await ensureParentDir(options.outputPath);
    await ensureParentDir(options.backupJsonPath);
    taskkillImage('AI Chat.exe');

    if (existsSync(USER_DATA_DIR)) {
      await rename(USER_DATA_DIR, userDataBackupPath);
      summary.userDataBackupPath = userDataBackupPath;
    }

    appChild = launchPackagedApp();
    try {
      session = await connectToPage({
        port: DEBUG_PORT,
        matcher: target => target.type === 'page' && typeof target.url === 'string' && target.url.startsWith('http://127.0.0.1:'),
      });
    } catch (error) {
      summary.packagedLaunchError = error instanceof Error ? error.message : String(error);
      await closeChildProcess(appChild, 'AI Chat.exe');
      appChild = launchSourceElectronFallback();
      summary.launchMode = 'source-electron-fallback';
      session = await connectToPage({
        port: DEBUG_PORT,
        matcher: target => target.type === 'page' && typeof target.url === 'string' && target.url.startsWith('http://127.0.0.1:'),
      });
    }

    await session.evaluate(storageJsonExpression(seed));
    await session.send('Page.reload', { ignoreCache: true });
    await waitForUiReady(session);
    await waitForHeaderTitle(session, seed.conversationTitle);
    await waitForExpression(session, `
      (() => {
        const languageSwitch = document.querySelector('#language-switch');
        return document.documentElement.lang === 'en'
          && languageSwitch?.value === 'en'
          && window.localStorage.getItem('locale') === 'en'
          && [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Help');
      })()
    `, 'english locale after packaged seed');
    summary.localeVerified = true;

    await openAbout(session);
    summary.aboutDetails = await waitForAboutDetails(session);

    await clickButtonByText(session, 'Export logs');
    summary.logExportStatus = await waitForStatusText(session, 'Exported sanitized logs:');
    summary.sanitizedLogPath = summary.logExportStatus?.replace('Exported sanitized logs: ', '') ?? null;

    await clickButtonByText(session, 'Export backup');
    summary.backupExportStatus = await waitForStatusText(session, 'Exported backup created at');
    const createdAt = summary.backupExportStatus.replace('Exported backup created at ', '').replace(/\.$/, '');
    const storageSnapshot = await session.evaluate(captureStorageExpression());
    const backupEnvelope = buildBackupEnvelope(storageSnapshot, createdAt);
    await writeFile(options.backupJsonPath, JSON.stringify(backupEnvelope, null, 2));
    summary.backupFileExists = existsSync(options.backupJsonPath);

    await mutateStorageForRestoreCheck(session);
    await waitForExpression(session, `
      document.querySelector('header h1')?.textContent?.trim() !== ${JSON.stringify(seed.conversationTitle)}
    `, 'seeded conversation to disappear after storage mutation');

    await session.evaluate(`window.confirm = () => true; true;`);
    await session.setFileInputFiles(BACKUP_FILE_INPUT_SELECTOR, [options.backupJsonPath.replaceAll('\\', '/')]);
    await session.evaluate(`
      (() => {
        const input = document.querySelector(${JSON.stringify(BACKUP_FILE_INPUT_SELECTOR)});
        if (!input) {
          return false;
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
    await waitForHeaderTitle(session, seed.conversationTitle);
    summary.restoreStatus = await session.evaluate(`
      (() => {
        return [...document.querySelectorAll('p')]
          .map(node => node.textContent?.trim() || '')
          .find(text => text.includes('Restored backup from')) || null;
      })()
    `);
    await waitForExpression(session, `
      (() => {
        const languageSwitch = document.querySelector('#language-switch');
        return document.documentElement.lang === 'en'
          && languageSwitch?.value === 'en'
          && window.localStorage.getItem('locale') === 'en'
          && [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Help');
      })()
    `, 'english locale after packaged restore');
    summary.restoreVerified = true;
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (session) {
      await requestGracefulClose(session, appChild, summary.launchMode === 'packaged' ? 'AI Chat.exe' : null);
    } else if (appChild) {
      await closeChildProcess(appChild, summary.launchMode === 'packaged' ? 'AI Chat.exe' : null);
    }

    taskkillImage('AI Chat.exe');

    if (summary.userDataBackupPath && existsSync(summary.userDataBackupPath)) {
      try {
        await restoreUserDataWithRetries(summary.userDataBackupPath);
        summary.restoredOriginalUserData = true;
      } catch (error) {
        summary.restoreOriginalUserDataError = error instanceof Error ? error.message : String(error);
      }
    }

    await ensureParentDir(options.outputPath);
    await writeFile(options.outputPath, JSON.stringify(summary, null, 2));
  }
}

await main();
