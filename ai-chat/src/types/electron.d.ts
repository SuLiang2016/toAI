import { ProviderSettings } from './chat';

declare global {
  interface Window {
    aiChat?: {
      getSettings: () => Promise<ProviderSettings>;
      saveSettings: (settings: ProviderSettings) => Promise<ProviderSettings>;
      getAppInfo: () => Promise<{ version: string; platform: string }>;
      getDiagnostics: () => Promise<{ logsPath: string; lastStartupDiagnostic: unknown }>;
      exportLogs: () => Promise<{ path: string }>;
      openLogs: () => Promise<{ path: string; error: string | null }>;
    };
  }
}

export {};
