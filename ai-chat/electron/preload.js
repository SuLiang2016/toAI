/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aiChat', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: settings => ipcRenderer.invoke('settings:save', settings),
  getAppInfo: () => ipcRenderer.invoke('app-info:get'),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  exportLogs: () => ipcRenderer.invoke('logs:export'),
  openLogs: () => ipcRenderer.invoke('logs:open'),
});
