/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const next = require('next');
const os = require('os');
const path = require('path');

let mainWindow;
let nextServer;
let lastStartupDiagnostic = null;

const FALLBACK_BOUNDS = {
  width: 1200,
  height: 800,
};
const PRODUCTION_SERVER_HOST = '127.0.0.1';
const PRODUCTION_SERVER_PORT_BASE = 30000;
const PRODUCTION_SERVER_PORT_SPAN = 10000;

function getStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'provider-settings.json');
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

function getStableProductionPort() {
  const appIdentity = app.getName().toLowerCase();
  let hash = 0;

  for (const char of appIdentity) {
    hash = (hash * 31 + char.charCodeAt(0)) % PRODUCTION_SERVER_PORT_SPAN;
  }

  return PRODUCTION_SERVER_PORT_BASE + hash;
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
  if (nextServer) return nextServer.url;

  const nextApp = next({ dev: false, dir: app.getAppPath() });
  await nextApp.prepare();

  const handler = nextApp.getRequestHandler();
  const server = http.createServer((request, response) => handler(request, response));
  const port = getStableProductionPort();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    // Keep a stable packaged origin so Chromium localStorage persists across relaunches.
    server.listen(port, PRODUCTION_SERVER_HOST, resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine embedded Next server port');
  }

  nextServer = {
    server,
    url: `http://${PRODUCTION_SERVER_HOST}:${address.port}`,
  };
  lastStartupDiagnostic = { status: 'ok', url: nextServer.url, at: new Date().toISOString() };
  return nextServer.url;
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
    }
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
  if (nextServer) {
    nextServer.server.close();
    nextServer = null;
  }
});
