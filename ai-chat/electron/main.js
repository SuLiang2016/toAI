/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const next = require('next');
const os = require('os');
const path = require('path');

let mainWindow;
let nextHandlerPromise;
const nextServers = new Map();
let lastStartupDiagnostic = null;

const FALLBACK_BOUNDS = {
  width: 1200,
  height: 800,
};
const PRODUCTION_SERVER_HOST = '127.0.0.1';
const PRODUCTION_SERVER_PORT_BASE = 30000;
const PRODUCTION_SERVER_PORT_SPAN = 10000;
const APP_OWNED_LOCAL_STORAGE_KEYS = [
  'conversations',
  'currentConversationId',
  'conversationDrafts',
  'newConversationDraft',
  'promptTemplates',
  'providerPresets',
  'activeProviderPresetId',
];
const LEGACY_LOCAL_STORAGE_ORIGIN_PATTERN = /META:(http:\/\/127\.0\.0\.1:\d+)/g;

function getStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'provider-settings.json');
}

function getLocalStorageMigrationPath() {
  return path.join(app.getPath('userData'), 'local-storage-migration.json');
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readMigrationState() {
  return readJson(getLocalStorageMigrationPath(), null);
}

function getStableProductionPort() {
  const appIdentity = app.getName().toLowerCase();
  let hash = 0;

  for (const char of appIdentity) {
    hash = (hash * 31 + char.charCodeAt(0)) % PRODUCTION_SERVER_PORT_SPAN;
  }

  return PRODUCTION_SERVER_PORT_BASE + hash;
}

function getStableProductionOrigin() {
  return `http://${PRODUCTION_SERVER_HOST}:${getStableProductionPort()}`;
}

function getLocalStorageLevelDbPath() {
  return path.join(app.getPath('userData'), 'Local Storage', 'leveldb');
}

function findLegacyLocalStorageOrigins() {
  const levelDbPath = getLocalStorageLevelDbPath();
  if (!fs.existsSync(levelDbPath)) {
    return [];
  }

  const stableOrigin = getStableProductionOrigin();
  const origins = new Set();
  for (const entry of fs.readdirSync(levelDbPath, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:log|ldb)$/i.test(entry.name)) continue;
    const absolutePath = path.join(levelDbPath, entry.name);
    let contents;
    try {
      contents = fs.readFileSync(absolutePath).toString('latin1');
    } catch (error) {
      logAppEvent('legacy-local-storage-scan-skipped-file', {
        file: entry.name,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    let match;
    while ((match = LEGACY_LOCAL_STORAGE_ORIGIN_PATTERN.exec(contents))) {
      if (match[1] && match[1] !== stableOrigin) {
        origins.add(match[1]);
      }
    }
    LEGACY_LOCAL_STORAGE_ORIGIN_PATTERN.lastIndex = 0;
  }

  return [...origins];
}

function hasAppOwnedLocalStorageData(snapshot) {
  return APP_OWNED_LOCAL_STORAGE_KEYS.some(key => {
    const value = snapshot?.[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return typeof value === 'string' ? value.length > 0 : value !== null && value !== undefined;
  });
}

async function getProductionRequestHandler() {
  if (!nextHandlerPromise) {
    nextHandlerPromise = (async () => {
      const nextApp = next({ dev: false, dir: app.getAppPath() });
      await nextApp.prepare();
      return nextApp.getRequestHandler();
    })();
  }

  return nextHandlerPromise;
}

async function startProductionNextServerOnPort(port) {
  const existingServer = nextServers.get(port);
  if (existingServer) {
    return `http://${PRODUCTION_SERVER_HOST}:${port}`;
  }

  const handler = await getProductionRequestHandler();
  const server = http.createServer((request, response) => handler(request, response));

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, PRODUCTION_SERVER_HOST, resolve);
  });

  nextServers.set(port, server);
  return `http://${PRODUCTION_SERVER_HOST}:${port}`;
}

async function captureAppOwnedLocalStorage(browserWindow) {
  return browserWindow.webContents.executeJavaScript(`
    (() => {
      const readJson = key => {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      };

      return {
        conversations: readJson('conversations'),
        currentConversationId: window.localStorage.getItem('currentConversationId'),
        conversationDrafts: readJson('conversationDrafts'),
        newConversationDraft: window.localStorage.getItem('newConversationDraft'),
        promptTemplates: readJson('promptTemplates'),
        providerPresets: readJson('providerPresets'),
        activeProviderPresetId: window.localStorage.getItem('activeProviderPresetId'),
      };
    })();
  `);
}

async function applyAppOwnedLocalStorage(browserWindow, snapshot) {
  const serializedSnapshot = JSON.stringify(snapshot);
  await browserWindow.webContents.executeJavaScript(`
    (() => {
      const snapshot = ${serializedSnapshot};
      const writeJson = (key, value) => {
        if (value === null || value === undefined) {
          window.localStorage.removeItem(key);
          return;
        }
        window.localStorage.setItem(key, JSON.stringify(value));
      };

      writeJson('conversations', snapshot.conversations);
      if (snapshot.currentConversationId) {
        window.localStorage.setItem('currentConversationId', snapshot.currentConversationId);
      } else {
        window.localStorage.removeItem('currentConversationId');
      }
      writeJson('conversationDrafts', snapshot.conversationDrafts || {});
      window.localStorage.setItem('newConversationDraft', snapshot.newConversationDraft || '');
      writeJson('promptTemplates', snapshot.promptTemplates || []);
      writeJson('providerPresets', snapshot.providerPresets || []);
      if (snapshot.activeProviderPresetId) {
        window.localStorage.setItem('activeProviderPresetId', snapshot.activeProviderPresetId);
      } else {
        window.localStorage.removeItem('activeProviderPresetId');
      }
      return true;
    })();
  `);
}

async function readLegacyLocalStorageSnapshot(origin) {
  const legacyUrl = await startProductionNextServerOnPort(Number(new URL(origin).port));
  const migrationWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  try {
    await migrationWindow.loadURL(legacyUrl);
    return await captureAppOwnedLocalStorage(migrationWindow);
  } finally {
    if (!migrationWindow.isDestroyed()) {
      migrationWindow.destroy();
    }
  }
}

async function findLegacyMigrationCandidate() {
  const migrationState = readMigrationState();
  if (migrationState?.completedAt) {
    return null;
  }

  for (const origin of findLegacyLocalStorageOrigins()) {
    try {
      const snapshot = await readLegacyLocalStorageSnapshot(origin);
      if (hasAppOwnedLocalStorageData(snapshot)) {
        return { origin, snapshot };
      }
    } catch (error) {
      logAppEvent('legacy-local-storage-read-failed', {
        origin,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return null;
}

async function reloadWindowAndWait(browserWindow) {
  await new Promise(resolve => {
    browserWindow.webContents.once('did-finish-load', resolve);
    browserWindow.webContents.reloadIgnoringCache();
  });
}

function readWindowBounds() {
  const saved = readJson(getStatePath(), {});
  const width = Number(saved.width);
  const height = Number(saved.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 800 || height < 600) {
    return FALLBACK_BOUNDS;
  }

  return {
    x: Number.isFinite(Number(saved.x)) ? Number(saved.x) : undefined,
    y: Number.isFinite(Number(saved.y)) ? Number(saved.y) : undefined,
    width,
    height,
  };
}

function saveWindowBounds() {
  if (!mainWindow) return;
  writeJson(getStatePath(), mainWindow.getBounds());
}

function sanitizeSettings(settings) {
  const safeSettings = {};
  const baseUrl = typeof settings?.baseUrl === 'string' ? settings.baseUrl.trim() : '';
  const model = typeof settings?.model === 'string' ? settings.model.trim() : '';

  if (baseUrl) safeSettings.baseUrl = baseUrl;
  if (model) safeSettings.model = model;
  if (typeof settings?.supportsAttachments === 'boolean') {
    safeSettings.supportsAttachments = settings.supportsAttachments;
  }

  return safeSettings;
}

function isLegacyDefaultSettings(settings) {
  return (
    settings?.version === undefined &&
    settings?.baseUrl === 'https://api.openai.com/v1' &&
    settings?.model === 'gpt-3.5-turbo' &&
    settings?.supportsAttachments === false
  );
}

function logAppEvent(message, details) {
  const logPath = path.join(app.getPath('logs'), 'main.log');
  const safeDetails = details ? sanitizeLogText(JSON.stringify(details)) : '';
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message} ${safeDetails}${os.EOL}`);
}

function getMainLogPath() {
  return path.join(app.getPath('logs'), 'main.log');
}

function sanitizeLogText(text) {
  return String(text)
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
    .replace(/(["']?(?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?)[^"',}\s]+(["']?)/gi, '$1***$2')
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, '[local path]')
    .replace(/\/(?:Users|home|var|tmp|etc)\/[^\s"'<>]+/g, '[local path]');
}

function exportSanitizedLogs() {
  const source = getMainLogPath();
  const target = path.join(app.getPath('userData'), 'sanitized-main.log');
  const content = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : '';
  fs.writeFileSync(target, sanitizeLogText(content));
  return target;
}

function registerIpc() {
  ipcMain.handle('settings:get', () => {
    const settings = readJson(getSettingsPath(), {});
    return isLegacyDefaultSettings(settings) ? {} : sanitizeSettings(settings);
  });
  ipcMain.handle('settings:save', (_event, settings) => {
    const safeSettings = {
      ...sanitizeSettings(settings),
      version: 1,
    };
    writeJson(getSettingsPath(), safeSettings);
    return safeSettings;
  });
  ipcMain.handle('app-info:get', () => ({
    version: app.getVersion(),
    platform: process.platform,
  }));
  ipcMain.handle('diagnostics:get', () => ({
    logsPath: getMainLogPath(),
    lastStartupDiagnostic,
  }));
  ipcMain.handle('logs:export', () => ({ path: exportSanitizedLogs() }));
  ipcMain.handle('logs:open', async () => {
    const target = exportSanitizedLogs();
    const error = await shell.openPath(target);
    return { path: target, error: error || null };
  });
}

async function startProductionNextServer() {
  const url = await startProductionNextServerOnPort(getStableProductionPort());
  lastStartupDiagnostic = { status: 'ok', url, at: new Date().toISOString() };
  return url;
}

async function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  const bounds = readWindowBounds();

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  mainWindow.on('close', saveWindowBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  try {
    if (isDev) {
      await mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      await mainWindow.loadURL(await startProductionNextServer());
      const currentSnapshot = await captureAppOwnedLocalStorage(mainWindow);
      if (!hasAppOwnedLocalStorageData(currentSnapshot)) {
        const legacyMigration = await findLegacyMigrationCandidate();
        if (legacyMigration?.snapshot) {
          await applyAppOwnedLocalStorage(mainWindow, legacyMigration.snapshot);
          writeJson(getLocalStorageMigrationPath(), {
            migratedFromOrigin: legacyMigration.origin,
            completedAt: new Date().toISOString(),
            migratedKeys: APP_OWNED_LOCAL_STORAGE_KEYS,
          });
          await reloadWindowAndWait(mainWindow);
        }
      }
    }
    mainWindow.show();
  } catch (error) {
    lastStartupDiagnostic = {
      status: 'failed',
      message: sanitizeLogText(error.message),
      at: new Date().toISOString(),
    };
    logAppEvent('window-load-failed', { message: error.message });
    throw error;
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow().catch(error => logAppEvent('create-window-failed', { message: error.message }));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(error => logAppEvent('create-window-failed', { message: error.message }));
  }
});

app.on('before-quit', () => {
  for (const server of nextServers.values()) {
    server.close();
  }
  nextServers.clear();
});
