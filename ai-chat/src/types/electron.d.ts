import { ProviderSettings } from './chat';

declare global {
  interface Window {
    aiChat?: {
      getSettings: () => Promise<ProviderSettings>;
      saveSettings: (settings: ProviderSettings) => Promise<ProviderSettings>;
      getAppInfo: () => Promise<{ version: string; platform: string }>;
    };
  }
}

export {};
