import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  clickButtonByText,
  clickButtonContainingText,
  clickSelector,
  closeChildProcess,
  connectToPage,
  ensureParentDir,
  fillInput,
  findBrowserExecutable,
  getPnpmCommand,
  recreateDir,
  requestGracefulClose,
  waitFor,
  waitForExpression,
  waitForUiReady,
} from './smoke-helpers.mjs';

const DEFAULT_OUTPUT_PATH = path.resolve('output/playwright/browser-workspace-smoke-2026-05-24.json');
const TARGET_PORT = 3100;
const TARGET_URL = `http://127.0.0.1:${TARGET_PORT}`;
const DEBUG_PORT = 9322;
const PROFILE_DIR = path.resolve(`output/playwright/browser-smoke-profile-${Date.now()}`);
const HELP_LABEL_ZH = '\u4f7f\u7528\u8bf4\u660e';
const HELP_CLOSE_ARIA_ZH = '\u5173\u95ed\u4f7f\u7528\u8bf4\u660e';
const SEARCH_PLACEHOLDER_ZH = '\u641c\u7d22\u4f1a\u8bdd';
const INBOX_LABEL_ZH = '\u6536\u4ef6\u7bb1';
const ARCHIVED_PREFIX_ZH = '\u5df2\u5f52\u6863\uff08';
const NEW_CHAT_LABEL_ZH = '+ \u65b0\u5bf9\u8bdd';
const DRAFT_ARIA_LABEL_ZH = '\u804a\u5929\u6d88\u606f\u8349\u7a3f';
const RENAME_ARIA_ZH = title => `\u91cd\u547d\u540d\u4f1a\u8bdd ${title}`;
const ARCHIVE_ARIA_ZH = title => `\u5f52\u6863\u4f1a\u8bdd ${title}`;

function parseArgs(argv) {
  const options = {
    outputPath: DEFAULT_OUTPUT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];
    if (arg === '--output' && nextValue) {
      options.outputPath = path.resolve(nextValue);
      index += 1;
    }
  }

  return options;
}

function createSeedState() {
  const conversationId = 'browser-smoke-conversation-1';
  const providerId = 'browser-smoke-provider-1';
  const now = Date.now();

  return {
    conversationId,
    providerId,
    conversationTitle: 'Browser smoke seed conversation',
    renamedConversationTitle: 'Browser smoke renamed',
    draftText: 'Browser smoke draft persists after reload.',
    localStorage: {
      locale: 'zh-CN',
      conversations: [
        {
          id: conversationId,
          title: 'Browser smoke seed conversation',
          createdAt: now - 10_000,
          updatedAt: now - 5_000,
          pinned: true,
          archived: false,
          provider: {
            id: providerId,
            name: 'Browser Smoke Provider',
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
              id: 'browser-smoke-user-1',
              role: 'user',
              content: 'Keep this browser smoke stable',
              timestamp: now - 9_000,
              status: 'complete',
            },
            {
              id: 'browser-smoke-assistant-1',
              role: 'assistant',
              content: 'Browser workspace state seeded',
              timestamp: now - 8_000,
              status: 'complete',
            },
          ],
        },
      ],
      currentConversationId: conversationId,
      conversationDrafts: {
        [conversationId]: '',
      },
      newConversationDraft: '',
      promptTemplates: [
        {
          id: 'browser-template-1',
          title: 'Browser smoke template',
          content: 'Keep browser workspace flows stable.',
          createdAt: now - 7_000,
          updatedAt: now - 7_000,
        },
      ],
      providerPresets: [
        {
          id: providerId,
          name: 'Browser Smoke Provider',
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
      localStorage.setItem('locale', seed.locale);
      localStorage.setItem('conversations', JSON.stringify(seed.conversations));
      localStorage.setItem('currentConversationId', seed.currentConversationId);
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

async function waitForHeaderTitle(session, expectedTitle) {
  await waitForExpression(session, `
    (() => document.querySelector('header h1')?.textContent?.trim() === ${JSON.stringify(expectedTitle)})()
  `, `header title ${expectedTitle}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seed = createSeedState();
  const summary = {
    ranAt: new Date().toISOString(),
    outputPath: options.outputPath,
    targetUrl: TARGET_URL,
    browserExecutable: null,
    profileDir: PROFILE_DIR,
    defaultLocaleVerified: false,
    seededTitle: null,
    helpModalVerified: false,
    helpEntryVisibleAfterReload: false,
    renamedTitle: null,
    searchQuery: 'renamed',
    archivedViewConfirmed: false,
    draftPersistedAfterReload: false,
    englishLocalePersistedAfterReload: false,
    finalSnapshot: null,
  };

  if (!existsSync(path.resolve('.next/BUILD_ID'))) {
    throw new Error('Browser smoke requires an existing Next.js production build. Run pnpm build first.');
  }

  let browserChild = null;
  let serverChild = null;
  let session = null;

  try {
    await ensureParentDir(options.outputPath);
    await recreateDir(PROFILE_DIR);

    const pnpm = getPnpmCommand();
    serverChild = process.platform === 'win32'
      ? spawn(
          'cmd.exe',
          ['/d', '/s', '/c', `${pnpm} exec next start --hostname 127.0.0.1 --port ${TARGET_PORT}`],
          { stdio: 'ignore' }
        )
      : spawn(
          pnpm,
          ['exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', String(TARGET_PORT)],
          { stdio: 'ignore' }
        );

    await waitFor(async () => {
      if (serverChild.exitCode !== null) {
        throw new Error(`Next.js server exited early with code ${serverChild.exitCode}`);
      }
      try {
        const response = await fetch(TARGET_URL, { redirect: 'manual' });
        return response.ok || response.status === 304;
      } catch {
        return false;
      }
    }, 'browser smoke Next.js server', 60000, 1000);

    summary.browserExecutable = findBrowserExecutable();
    browserChild = spawn(summary.browserExecutable, [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      '--disable-gpu',
      TARGET_URL,
    ], { stdio: 'ignore' });

    session = await connectToPage({
      port: DEBUG_PORT,
      matcher: target => target.type === 'page' && typeof target.url === 'string' && target.url.startsWith(TARGET_URL),
    });

    await waitForUiReady(session);
    await waitForExpression(session, `
      (() => {
        const languageSwitch = document.querySelector('#language-switch');
        return document.documentElement.lang === 'zh-CN'
          && languageSwitch?.value === 'zh-CN'
          && [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === ${JSON.stringify(HELP_LABEL_ZH)});
      })()
    `, 'default zh-CN locale on first launch');
    summary.defaultLocaleVerified = true;

    await session.evaluate(storageJsonExpression(seed));
    await session.send('Page.reload', { ignoreCache: true });
    await waitForUiReady(session);
    await waitForHeaderTitle(session, seed.conversationTitle);
    summary.seededTitle = seed.conversationTitle;

    await clickButtonByText(session, HELP_LABEL_ZH);
    await waitForExpression(session, `
      (() => {
        const text = document.body.textContent || '';
        return text.includes('\u6a21\u578b\u914d\u7f6e\u4e0e\u5207\u6362')
          && text.includes('\u63d0\u793a\u8bcd\u6a21\u677f\u7684\u521b\u5efa\u4e0e\u4f7f\u7528')
          && text.includes('\u521b\u5efa\u4e0e\u5207\u6362\u4f1a\u8bdd');
      })()
    `, 'help modal workflow sections');
    await clickSelector(session, `button[aria-label=${JSON.stringify(HELP_CLOSE_ARIA_ZH)}]`);
    await waitForExpression(session, `
      !document.querySelector(${JSON.stringify(`button[aria-label="${HELP_CLOSE_ARIA_ZH}"]`)})
    `, 'help modal to close');
    await waitForHeaderTitle(session, seed.conversationTitle);
    summary.helpModalVerified = true;

    await clickSelector(session, `button[aria-label=${JSON.stringify(RENAME_ARIA_ZH(seed.conversationTitle))}]`);
    await waitForExpression(session, `Boolean(document.querySelector('div.fixed input'))`, 'rename modal input');
    await fillInput(session, 'div.fixed input', seed.renamedConversationTitle);
    await clickButtonByText(session, '\u4fdd\u5b58');
    await waitForHeaderTitle(session, seed.renamedConversationTitle);
    summary.renamedTitle = seed.renamedConversationTitle;

    await fillInput(session, `input[placeholder=${JSON.stringify(SEARCH_PLACEHOLDER_ZH)}]`, 'renamed');
    await waitForExpression(session, `
      Boolean(document.querySelector(${JSON.stringify(`button[aria-label="${RENAME_ARIA_ZH(seed.renamedConversationTitle)}"]`)}))
    `, 'renamed conversation in filtered results');

    await clickSelector(session, `button[aria-label=${JSON.stringify(ARCHIVE_ARIA_ZH(seed.renamedConversationTitle))}]`);
    await waitForExpression(session, `
      !document.querySelector(${JSON.stringify(`button[aria-label="${RENAME_ARIA_ZH(seed.renamedConversationTitle)}"]`)})
    `, 'renamed conversation removed from inbox view');
    await clickButtonContainingText(session, INBOX_LABEL_ZH);
    await waitForExpression(session, `
      Boolean(document.querySelector(${JSON.stringify(`button[aria-label="${RENAME_ARIA_ZH(seed.renamedConversationTitle)}"]`)}))
    `, 'renamed conversation in archived view');
    summary.archivedViewConfirmed = true;

    await clickButtonContainingText(session, ARCHIVED_PREFIX_ZH);
    await fillInput(session, `input[placeholder=${JSON.stringify(SEARCH_PLACEHOLDER_ZH)}]`, '');
    await clickButtonByText(session, NEW_CHAT_LABEL_ZH);
    await fillInput(session, `textarea[aria-label=${JSON.stringify(DRAFT_ARIA_LABEL_ZH)}]`, seed.draftText);
    await waitForExpression(session, `
      window.localStorage.getItem('newConversationDraft') === ${JSON.stringify(seed.draftText)}
    `, 'new chat draft to persist');

    await session.send('Page.reload', { ignoreCache: true });
    await waitForUiReady(session);
    await waitForExpression(session, `
      [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === ${JSON.stringify(HELP_LABEL_ZH)})
    `, 'help entry after reload');
    summary.helpEntryVisibleAfterReload = true;
    await waitForExpression(session, `
      window.localStorage.getItem('newConversationDraft') === ${JSON.stringify(seed.draftText)}
    `, 'new chat draft key after reload');
    await clickButtonByText(session, NEW_CHAT_LABEL_ZH);
    await waitForExpression(session, `
      document.querySelector(${JSON.stringify(`textarea[aria-label="${DRAFT_ARIA_LABEL_ZH}"]`)})?.value === ${JSON.stringify(seed.draftText)}
    `, 'new chat draft restored after reload');
    summary.draftPersistedAfterReload = true;

    await session.evaluate(`
      (() => {
        const languageSwitch = document.querySelector('#language-switch');
        if (!languageSwitch) return false;
        languageSwitch.value = 'en';
        languageSwitch.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
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
    `, 'english locale after switching');

    await session.send('Page.reload', { ignoreCache: true });
    await waitForUiReady(session);
    await waitForExpression(session, `
      (() => {
        const languageSwitch = document.querySelector('#language-switch');
        return document.documentElement.lang === 'en'
          && languageSwitch?.value === 'en'
          && window.localStorage.getItem('locale') === 'en'
          && [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Help');
      })()
    `, 'english locale after reload');
    summary.englishLocalePersistedAfterReload = true;

    summary.finalSnapshot = await session.evaluate(`
      (() => ({
        currentTitle: document.querySelector('header h1')?.textContent?.trim() || null,
        newConversationDraft: window.localStorage.getItem('newConversationDraft'),
        locale: window.localStorage.getItem('locale'),
      }))()
    `);
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (session) {
      await requestGracefulClose(session, browserChild, path.basename(summary.browserExecutable ?? 'msedge.exe'));
    } else if (browserChild) {
      await closeChildProcess(browserChild, path.basename(summary.browserExecutable ?? 'msedge.exe'));
    }

    if (serverChild) {
      await closeChildProcess(serverChild, null);
    }

    await ensureParentDir(options.outputPath);
    await writeFile(options.outputPath, JSON.stringify(summary, null, 2));
    await rm(PROFILE_DIR, { recursive: true, force: true });
  }
}

await main();
