/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const http = require('http');
const next = require('next');
const os = require('os');
const path = require('path');

let mainWindow;
let nextServer;

const FALLBACK_BOUNDS = {
  width: 1200,
  height: 800,
};

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
  const safeDetails = details ? JSON.stringify(details).replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***') : '';
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message} ${safeDetails}${os.EOL}`);
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
}

async function startProductionNextServer() {
  if (nextServer) return nextServer.url;

  const nextApp = next({ dev: false, dir: app.getAppPath() });
  await nextApp.prepare();

  const handler = nextApp.getRequestHandler();
  const server = http.createServer((request, response) => handler(request, response));

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine embedded Next server port');
  }

  nextServer = {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
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

  try {
    if (isDev) {
      await mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      await mainWindow.loadURL(await startProductionNextServer());
    }
  } catch (error) {
    logAppEvent('window-load-failed', { message: error.message });
    throw error;
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', saveWindowBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
