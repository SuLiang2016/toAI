import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_OLD_INSTALLER = 'C:/suliang/ai-chat-old/ai-chat/dist/AI Chat Setup 1.0.0.exe';
const DEFAULT_NEW_INSTALLER = 'C:/suliang/toAI/ai-chat/dist/AI Chat Setup 1.0.1.exe';
const DEFAULT_OUTPUT_PATH = 'C:/suliang/toAI/ai-chat/output/playwright/installer-upgrade-smoke-2026-05-24.json';
const DEFAULT_BACKUP_JSON_PATH = 'C:/suliang/toAI/ai-chat/output/playwright/installer-upgrade-backup-2026-05-24.json';
const INSTALL_DIR = 'C:/Users/admin/AppData/Local/Programs/ai-chat';
const INSTALLED_EXE = `${INSTALL_DIR}/AI Chat.exe`;
const UNINSTALL_EXE = `${INSTALL_DIR}/Uninstall AI Chat.exe`;
const USER_DATA_DIR = 'C:/Users/admin/AppData/Roaming/ai-chat';
const LOCAL_STORAGE_LEVELDB_DIR = `${USER_DATA_DIR}/Local Storage/leveldb`;
const MIGRATION_STATE_PATH = `${USER_DATA_DIR}/local-storage-migration.json`;
const PRODUCTION_SERVER_HOST = '127.0.0.1';
const PRODUCTION_SERVER_PORT_BASE = 30000;
const PRODUCTION_SERVER_PORT_SPAN = 10000;
const APP_IDENTITY = 'ai-chat';
const LEGACY_ORIGIN_PATTERN = /META:(http:\/\/127\.0\.0\.1:\d+)/g;
const APP_STORAGE_KEYS = [
  'conversations',
  'currentConversationId',
  'conversationDrafts',
  'newConversationDraft',
  'promptTemplates',
  'providerPresets',
  'activeProviderPresetId',
  'providerSettings',
];
const BACKUP_FILE_INPUT_SELECTOR = 'input[type="file"][accept*="application/json"]';

function parseArgs(argv) {
  const options = {
    oldInstaller: DEFAULT_OLD_INSTALLER,
    newInstaller: DEFAULT_NEW_INSTALLER,
    outputPath: DEFAULT_OUTPUT_PATH,
    backupJsonPath: DEFAULT_BACKUP_JSON_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];
    if (arg === '--old-installer' && nextValue) {
      options.oldInstaller = nextValue;
      index += 1;
    } else if (arg === '--new-installer' && nextValue) {
      options.newInstaller = nextValue;
      index += 1;
    } else if (arg === '--output' && nextValue) {
      options.outputPath = nextValue;
      index += 1;
    } else if (arg === '--backup-json' && nextValue) {
      options.backupJsonPath = nextValue;
      index += 1;
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(await readFile(filePath, 'utf8'));
}

function runCommand(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function taskkillImage(imageName) {
  try {
    execFileSync('taskkill', ['/IM', imageName, '/T', '/F'], { stdio: 'ignore' });
  } catch {
    // Ignore "not found" style failures.
  }
}

async function waitFor(check, description, timeoutMs = 60000, intervalMs = 1000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) return result;
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${description}`);
}

async function waitForChildExit(child, timeoutMs = 10000, intervalMs = 500) {
  if (!child) {
    return;
  }

  await waitFor(() => child.exitCode !== null, `process ${child.pid} to exit`, timeoutMs, intervalMs);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchDebuggerTargets(port) {
  return fetchJson(`http://127.0.0.1:${port}/json/list`);
}

async function scanLegacyStorageArtifacts(seed) {
  if (!existsSync(LOCAL_STORAGE_LEVELDB_DIR)) {
    return { origins: [], flushed: false };
  }

  const origins = new Set();
  let flushed = false;

  for (const entry of await readdir(LOCAL_STORAGE_LEVELDB_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:log|ldb)$/i.test(entry.name)) {
      continue;
    }

    let contents;
    try {
      contents = (await readFile(path.join(LOCAL_STORAGE_LEVELDB_DIR, entry.name))).toString('latin1');
    } catch {
      continue;
    }

    let match;
    while ((match = LEGACY_ORIGIN_PATTERN.exec(contents))) {
      if (match[1]) {
        origins.add(match[1]);
      }
    }
    LEGACY_ORIGIN_PATTERN.lastIndex = 0;

    if (contents.includes(seed.conversationId) && contents.includes('conversations')) {
      flushed = true;
    }
  }

  return { origins: [...origins], flushed };
}

function getStableProductionPort() {
  let hash = 0;
  for (const char of APP_IDENTITY) {
    hash = (hash * 31 + char.charCodeAt(0)) % PRODUCTION_SERVER_PORT_SPAN;
  }
  return PRODUCTION_SERVER_PORT_BASE + hash;
}

function getStableProductionOrigin() {
  return `http://${PRODUCTION_SERVER_HOST}:${getStableProductionPort()}`;
}

async function getPageDebuggerUrl(port, matcher = target => target.type === 'page') {
  return waitFor(async () => {
    try {
      const targets = await fetchDebuggerTargets(port);
      const pageTarget = targets.find(target => (
        typeof target.webSocketDebuggerUrl === 'string' &&
        matcher(target)
      ));
      return pageTarget?.webSocketDebuggerUrl ?? null;
    } catch {
      return null;
    }
  }, `page debugger target on port ${port}`, 60000, 1000);
}

class CdpSession {
  constructor(webSocketUrl) {
    this.id = 0;
    this.pending = new Map();
    this.webSocketUrl = webSocketUrl;
    this.socket = new WebSocket(webSocketUrl);
    this.openPromise = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const payload = JSON.parse(event.data);
      if (!Object.prototype.hasOwnProperty.call(payload, 'id')) {
        return;
      }

      const entry = this.pending.get(payload.id);
      if (!entry) return;
      this.pending.delete(payload.id);

      if (payload.error) {
        entry.reject(new Error(payload.error.message || `CDP error for ${entry.method}`));
      } else {
        entry.resolve(payload.result ?? {});
      }
    });
  }

  async ready() {
    await this.openPromise;
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (exceptionDetails) {
      throw new Error(exceptionDetails.text || 'Runtime evaluation failed');
    }

    return result?.value;
  }

  async setFileInputFiles(selector, files) {
    const { root } = await this.send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await this.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) {
      throw new Error(`Unable to locate file input for selector ${selector}`);
    }

    await this.send('DOM.setFileInputFiles', { nodeId, files });
  }

  close() {
    this.socket.close();
  }
}

async function requestGracefulAppClose(session, child) {
  if (!session) {
    return;
  }

  try {
    await Promise.race([
      session.send('Browser.close').catch(() => null),
      sleep(2000),
    ]);
  } catch {
    // Fall through to the normal shutdown path.
  }

  session.close();

  try {
    await waitForChildExit(child);
  } catch {
    await closeLaunchedApp(child);
  }
}

function createSeedState() {
  const conversationId = 'upgrade-conversation-1';
  const providerId = 'upgrade-provider-1';
  const now = Date.now();

  return {
    conversationId,
    providerId,
    conversationTitle: 'Legacy upgrade seed conversation',
    providerName: 'Legacy Upgrade Provider',
    providerModel: 'gpt-4.1-mini',
    localStorage: {
      conversations: [
        {
          id: conversationId,
          title: 'Legacy upgrade seed conversation',
          createdAt: now - 10_000,
          updatedAt: now - 5_000,
          pinned: true,
          archived: false,
          provider: {
            id: providerId,
            name: 'Legacy Upgrade Provider',
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
              id: 'upgrade-user-1',
              role: 'user',
              content: 'Upgrade me safely',
              timestamp: now - 9_000,
              status: 'complete',
            },
            {
              id: 'upgrade-assistant-1',
              role: 'assistant',
              content: 'Upgrade path seeded',
              timestamp: now - 8_000,
              status: 'complete',
            },
          ],
        },
      ],
      currentConversationId: conversationId,
      conversationDrafts: {
        [conversationId]: 'draft preserved across upgrade',
      },
      newConversationDraft: '',
      promptTemplates: [
        {
          id: 'template-upgrade-1',
          title: 'Upgrade template',
          content: 'Stay stable during installer upgrade',
          createdAt: now - 7_000,
          updatedAt: now - 7_000,
        },
      ],
      providerPresets: [
        {
          id: providerId,
          name: 'Legacy Upgrade Provider',
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

function captureAppStorageExpression() {
  return `
    (() => {
      const readJson = key => {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      };

      return {
        conversations: readJson('conversations'),
        currentConversationId: localStorage.getItem('currentConversationId'),
        conversationDrafts: readJson('conversationDrafts'),
        newConversationDraft: localStorage.getItem('newConversationDraft'),
        promptTemplates: readJson('promptTemplates'),
        providerPresets: readJson('providerPresets'),
        activeProviderPresetId: localStorage.getItem('activeProviderPresetId'),
      };
    })();
  `;
}

async function connectToPage(port, matcher) {
  const debuggerUrl = await getPageDebuggerUrl(port, matcher);
  const session = new CdpSession(debuggerUrl);
  await session.ready();
  await waitForUiReady(session);
  return session;
}

async function waitForUiReady(session) {
  await waitFor(async () => {
    try {
      return await session.evaluate(`
        document.readyState === 'complete'
          && Boolean(document.querySelector('button[aria-label="About"]'))
          && Boolean(document.querySelector('input[type="file"]'))
      `);
    } catch {
      return false;
    }
  }, 'hydrated chat UI', 60000, 1000);
}

async function openAbout(session) {
  await session.evaluate(`
    (() => {
      const button = document.querySelector('button[aria-label="About"]');
      if (!button) return false;
      button.click();
      return true;
    })()
  `);

  await waitFor(async () => {
    try {
      return await session.evaluate(`
        Boolean(document.querySelector('button[aria-label="Close about"]'))
          && [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Export backup')
      `);
    } catch {
      return false;
    }
  }, 'About modal', 15000, 500);
}

async function clickButtonByText(session, text) {
  const clicked = await session.evaluate(`
    (() => {
      const target = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === ${JSON.stringify(text)});
      if (!target) return false;
      target.click();
      return true;
    })()
  `);

  if (!clicked) {
    throw new Error(`Unable to find button with text "${text}"`);
  }
}

async function waitForBackupStatus(session, expectedText) {
  return waitFor(async () => {
    try {
      const text = await session.evaluate(`
        (() => {
          return [...document.querySelectorAll('p')]
            .map(node => node.textContent?.trim() || '')
            .find(text => text.includes(${JSON.stringify(expectedText)})) || null;
        })()
      `);
      return text || null;
    } catch {
      return null;
    }
  }, `backup status containing ${expectedText}`, 15000, 500);
}

async function waitForHeaderTitle(session, expectedTitle) {
  await waitFor(async () => {
    try {
      return await session.evaluate(`
        (() => {
          const heading = document.querySelector('header h1');
          return heading?.textContent?.trim() === ${JSON.stringify(expectedTitle)};
        })()
      `);
    } catch {
      return false;
    }
  }, `header title ${expectedTitle}`, 15000, 500);
}

async function waitForRetainedState(session, seed) {
  return waitFor(async () => {
    try {
      const snapshot = await captureUpgradeState(session);
      assertRetainedState(snapshot, seed);
      return snapshot;
    } catch {
      return null;
    }
  }, 'retained upgraded storage state', 60000, 1000);
}

async function captureUpgradeState(session) {
  return session.evaluate(`
    (() => {
      const providerLine = document.querySelector('header div.text-xs')?.textContent?.trim() || null;
      const title = document.querySelector('header h1')?.textContent?.trim() || null;
      const versionLine = [...document.querySelectorAll('div')]
        .map(node => node.textContent?.trim() || '')
        .find(text => text.startsWith('Version:')) || null;

      const readJson = key => {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      };

      return {
        title,
        providerLine,
        versionLine,
        storage: {
          conversations: readJson('conversations'),
          currentConversationId: localStorage.getItem('currentConversationId'),
          conversationDrafts: readJson('conversationDrafts'),
          promptTemplates: readJson('promptTemplates'),
          providerPresets: readJson('providerPresets'),
          activeProviderPresetId: localStorage.getItem('activeProviderPresetId'),
        },
      };
    })()
  `);
}

function buildBackupEnvelope(storageSnapshot, createdAt) {
  return {
    backupFormatVersion: 1,
    storageSchemaVersion: 2,
    createdAt,
    localStorage: {
      conversations: storageSnapshot.conversations ?? [],
      activeConversationId: storageSnapshot.currentConversationId ?? null,
      conversationDrafts: storageSnapshot.conversationDrafts ?? {},
      newConversationDraft: storageSnapshot.newConversationDraft ?? '',
      promptTemplates: storageSnapshot.promptTemplates ?? [],
      providerPresets: storageSnapshot.providerPresets ?? [],
      activeProviderPresetId: storageSnapshot.activeProviderPresetId ?? null,
      legacyProviderSettings: null,
    },
  };
}

function assertRetainedState(snapshot, seed) {
  const conversation = snapshot?.storage?.conversations?.find(item => item.id === seed.conversationId);
  if (!conversation || conversation.title !== seed.conversationTitle) {
    throw new Error('Upgraded app did not retain the seeded conversation.');
  }

  const preset = snapshot?.storage?.providerPresets?.find(item => item.id === seed.providerId);
  if (!preset || preset.name !== seed.providerName || snapshot.storage.activeProviderPresetId !== seed.providerId) {
    throw new Error('Upgraded app did not retain the active provider preset.');
  }

  if (!snapshot?.storage?.conversationDrafts?.[seed.conversationId]) {
    throw new Error('Upgraded app did not retain the seeded draft.');
  }
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

async function installSilently(installerPath) {
  runCommand(installerPath, ['/S']);
  await waitFor(() => existsSync(INSTALLED_EXE), `installed executable from ${installerPath}`, 120000, 1000);
}

async function uninstallCurrentInstallIfPresent() {
  taskkillImage('AI Chat.exe');
  if (!existsSync(UNINSTALL_EXE)) {
    return false;
  }

  runCommand(UNINSTALL_EXE, ['/S']);
  await waitFor(() => !existsSync(INSTALLED_EXE), 'existing install to uninstall', 120000, 1000).catch(() => null);
  return true;
}

function launchInstalledApp(port) {
  const child = spawn(INSTALLED_EXE, [`--remote-debugging-port=${port}`], {
    detached: false,
    stdio: 'ignore',
  });
  return child;
}

async function closeLaunchedApp(child) {
  if (!child || child.exitCode !== null) {
    taskkillImage('AI Chat.exe');
    return;
  }

  try {
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    taskkillImage('AI Chat.exe');
  }

  await sleep(2000);
}

async function removeDirWithRetries(targetPath, attempts = 8) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
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

async function waitForLegacyStorageFlush(seed) {
  return waitFor(async () => {
    const result = await scanLegacyStorageArtifacts(seed);
    return result.flushed && result.origins.length > 0 ? result : null;
  }, 'legacy localStorage flush to LevelDB', 30000, 1000);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const seed = createSeedState();
  const timestamp = new Date().toISOString();
  const userDataBackupPath = `${USER_DATA_DIR}.batch1-backup-${Date.now()}`;
  const summary = {
    ranAt: timestamp,
    oldInstaller: options.oldInstaller,
    newInstaller: options.newInstaller,
    outputPath: options.outputPath,
    backupJsonPath: options.backupJsonPath,
    userDataBackupPath: null,
    originalInstallPresent: existsSync(INSTALLED_EXE),
    originalUserDataPresent: existsSync(USER_DATA_DIR),
    uninstalledExistingApp: false,
    oldVersionSeeded: null,
    legacyStorageArtifacts: null,
    postUpgradeState: null,
    postUpgradeMigrationState: null,
    postUpgradeTargetUrl: null,
    postUpgradeTargets: null,
    backupExportStatus: null,
    restoreVerified: false,
    restoredOriginalUserData: false,
  };

  let oldApp = null;
  let newApp = null;

  try {
    if (!existsSync(options.oldInstaller)) {
      throw new Error(`Old installer not found: ${options.oldInstaller}`);
    }
    if (!existsSync(options.newInstaller)) {
      throw new Error(`New installer not found: ${options.newInstaller}`);
    }

    await ensureParentDir(options.outputPath);
    await ensureParentDir(options.backupJsonPath);

    summary.uninstalledExistingApp = await uninstallCurrentInstallIfPresent();

    if (existsSync(USER_DATA_DIR)) {
      await rename(USER_DATA_DIR, userDataBackupPath);
      summary.userDataBackupPath = userDataBackupPath;
    }

    await installSilently(options.oldInstaller);
    oldApp = launchInstalledApp(9440);

    let session = await connectToPage(9440);
    await session.evaluate(storageJsonExpression(seed));
    await session.send('Page.reload', { ignoreCache: true });
    await waitForUiReady(session);
    await waitForHeaderTitle(session, seed.conversationTitle);
    summary.oldVersionSeeded = await captureUpgradeState(session);
    await requestGracefulAppClose(session, oldApp);
    oldApp = null;
    summary.legacyStorageArtifacts = await waitForLegacyStorageFlush(seed);

    await installSilently(options.newInstaller);
    newApp = launchInstalledApp(9441);
    summary.postUpgradeTargets = await fetchDebuggerTargets(9441).catch(() => null);
    session = await connectToPage(
      9441,
      target => target.type === 'page' && typeof target.url === 'string' && target.url.startsWith(getStableProductionOrigin())
    );
    summary.postUpgradeTargetUrl = session.webSocketUrl;
    summary.postUpgradeState = await waitForRetainedState(session, seed);
    summary.postUpgradeMigrationState = await readJsonIfExists(MIGRATION_STATE_PATH);
    assertRetainedState(summary.postUpgradeState, seed);
    await waitForHeaderTitle(session, seed.conversationTitle);

    await openAbout(session);
    const versionLine = await session.evaluate(`
      [...document.querySelectorAll('div')]
        .map(node => node.textContent?.trim() || '')
        .find(text => text.includes('Version:')) || null
    `);
    if (!versionLine || !versionLine.includes('Version: 1.0.1')) {
      throw new Error(`Unexpected About version line after upgrade: ${versionLine}`);
    }

    await clickButtonByText(session, 'Export backup');
    const backupStatus = await waitForBackupStatus(session, 'Exported backup created at');
    summary.backupExportStatus = backupStatus;

    const storageSnapshot = await session.evaluate(captureAppStorageExpression());
    const createdAt = backupStatus.replace('Exported backup created at ', '').replace(/\.$/, '');
    const backupEnvelope = buildBackupEnvelope(storageSnapshot, createdAt);
    await writeFile(options.backupJsonPath, JSON.stringify(backupEnvelope, null, 2));

    await mutateStorageForRestoreCheck(session);
    const titleAfterMutation = await session.evaluate(`document.querySelector('header h1')?.textContent?.trim() || null`);
    if (titleAfterMutation === seed.conversationTitle) {
      throw new Error('Storage mutation did not clear the seeded conversation before restore.');
    }

    await session.evaluate(`window.confirm = () => true; true;`);
    await session.setFileInputFiles(BACKUP_FILE_INPUT_SELECTOR, [options.backupJsonPath.replaceAll('\\', '/')]);
    await session.evaluate(`
      (() => {
        const input = document.querySelector(${JSON.stringify(BACKUP_FILE_INPUT_SELECTOR)});
        if (!input) return false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);
    const restoredState = await waitForRetainedState(session, seed);
    assertRetainedState(restoredState, seed);
    await waitForHeaderTitle(session, seed.conversationTitle);
    summary.restoreVerified = true;
    summary.postRestoreState = restoredState;

    await requestGracefulAppClose(session, newApp);
    newApp = null;
  } finally {
    if (oldApp) {
      await closeLaunchedApp(oldApp);
    }
    if (newApp) {
      await closeLaunchedApp(newApp);
    }
    taskkillImage('AI Chat.exe');

    if (!summary.postUpgradeMigrationState) {
      summary.postUpgradeMigrationState = await readJsonIfExists(MIGRATION_STATE_PATH).catch(() => null);
    }

    if (summary.userDataBackupPath && existsSync(summary.userDataBackupPath)) {
      try {
        await restoreUserDataWithRetries(summary.userDataBackupPath);
        summary.restoredOriginalUserData = true;
      } catch (error) {
        summary.restoreOriginalUserDataError = error instanceof Error ? error.message : String(error);
      }
    }

    await writeFile(options.outputPath, JSON.stringify(summary, null, 2));
  }
}

await main();
