export interface TemplateFormDraft {
  id: string | null;
  title: string;
  content: string;
}

export interface ProviderPresetFormDraft {
  id: string | null;
  name: string;
  baseUrl: string;
  model: string;
  supportsAttachments: boolean;
}

export interface AboutInfo {
  version: string;
  platform: string;
}

export interface DiagnosticsInfo {
  logsPath: string;
  lastStartupDiagnostic: unknown;
}

