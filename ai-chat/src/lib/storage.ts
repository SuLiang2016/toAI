import {
  Conversation,
  Message,
  PromptTemplate,
  ProviderCapabilities,
  ProviderPreset,
  ProviderSettings,
  ProviderSnapshot,
} from '@/types/chat';

export const STORAGE_SCHEMA_VERSION = 2;
export const CONVERSATIONS_KEY = 'conversations';
export const ACTIVE_CONVERSATION_KEY = 'currentConversationId';
export const CONVERSATION_DRAFTS_KEY = 'conversationDrafts';
export const NEW_CONVERSATION_DRAFT_KEY = 'newConversationDraft';
export const PROMPT_TEMPLATES_KEY = 'promptTemplates';
export const PROVIDER_PRESETS_KEY = 'providerPresets';
export const ACTIVE_PROVIDER_PRESET_KEY = 'activeProviderPresetId';
export const PROVIDER_SETTINGS_KEY = 'providerSettings';

const LEGACY_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const LEGACY_DEFAULT_MODEL = 'gpt-3.5-turbo';
const DEFAULT_MAX_IMAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_TEXT_FILE_BYTES = 256 * 1024;

type StoredProviderSettings = ProviderSettings & {
  version?: number;
};

export interface ProviderValidationResult {
  ok: boolean;
  settings?: ProviderSettings;
  message?: string;
}

export function createStorageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadStoredConversations(): Conversation[] {
  const parsed = readLocalJson(CONVERSATIONS_KEY, []);
  return Array.isArray(parsed) ? parsed.map(normalizeConversation).filter(Boolean) as Conversation[] : [];
}

export function saveConversations(conversations: Conversation[]) {
  writeLocalJson(CONVERSATIONS_KEY, conversations.map(conversation => ({
    ...conversation,
    messages: conversation.messages.map(message => ({ status: 'complete', ...message })),
  })));
}

export function loadInitialConversationId(conversations = loadStoredConversations()): string | null {
  const activeId = loadStoredActiveConversationId();
  return conversations.some(conversation => conversation.id === activeId) ? activeId : conversations[0]?.id ?? null;
}

export function loadStoredActiveConversationId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(conversationId: string | null) {
  if (typeof window === 'undefined') return;

  if (conversationId) {
    window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId);
  } else {
    window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }
}

export function loadDraftForConversation(conversationId: string | null): string {
  if (typeof window === 'undefined') return '';

  try {
    if (!conversationId) {
      return window.localStorage.getItem(NEW_CONVERSATION_DRAFT_KEY) ?? '';
    }

    return loadConversationDrafts()[conversationId] ?? '';
  } catch {
    return '';
  }
}

export function saveDraftForConversation(conversationId: string | null, draft: string) {
  if (typeof window === 'undefined') return;

  if (!conversationId) {
    if (draft) {
      window.localStorage.setItem(NEW_CONVERSATION_DRAFT_KEY, draft);
    } else {
      window.localStorage.removeItem(NEW_CONVERSATION_DRAFT_KEY);
    }
    return;
  }

  const drafts = loadConversationDrafts();
  if (draft) {
    drafts[conversationId] = draft;
  } else {
    delete drafts[conversationId];
  }
  saveConversationDrafts(drafts);
}

export function clearDraftForConversation(conversationId: string | null) {
  saveDraftForConversation(conversationId, '');
}

export function deleteDraftForConversation(conversationId: string) {
  const drafts = loadConversationDrafts();
  delete drafts[conversationId];
  saveConversationDrafts(drafts);
}

export function pruneConversationDrafts(conversationIds: string[]): number {
  const allowed = new Set(conversationIds);
  const drafts = loadConversationDrafts();
  const nextDrafts = Object.fromEntries(Object.entries(drafts).filter(([id]) => allowed.has(id)));
  const removed = Object.keys(drafts).length - Object.keys(nextDrafts).length;
  saveConversationDrafts(nextDrafts);
  return removed;
}

export function loadConversationDrafts(): Record<string, string> {
  const parsed = readLocalJson(CONVERSATION_DRAFTS_KEY, {});

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => typeof value === 'string')
  ) as Record<string, string>;
}

export function saveConversationDrafts(drafts: Record<string, string>) {
  if (Object.keys(drafts).length > 0) {
    writeLocalJson(CONVERSATION_DRAFTS_KEY, drafts);
  } else if (typeof window !== 'undefined') {
    window.localStorage.removeItem(CONVERSATION_DRAFTS_KEY);
  }
}

export function loadStoredPromptTemplates(): PromptTemplate[] {
  const parsed = readLocalJson(PROMPT_TEMPLATES_KEY, []);
  return Array.isArray(parsed) ? parsed.map(normalizePromptTemplate).filter(Boolean) as PromptTemplate[] : [];
}

export function savePromptTemplates(templates: PromptTemplate[]) {
  writeLocalJson(PROMPT_TEMPLATES_KEY, templates.map(template => ({
    ...template,
    version: STORAGE_SCHEMA_VERSION,
  })));
}

export function loadStoredProviderPresets(): ProviderPreset[] {
  const saved = readLocalJson(PROVIDER_PRESETS_KEY, undefined);
  if (saved !== undefined) {
    return Array.isArray(saved) ? saved.map(normalizeProviderPreset).filter(Boolean) as ProviderPreset[] : [];
  }

  return migrateLegacyProviderSettings();
}

export function saveProviderPresets(presets: ProviderPreset[]) {
  writeLocalJson(PROVIDER_PRESETS_KEY, presets.map(preset => ({
    ...normalizeProviderSettings(preset),
    id: preset.id,
    name: preset.name,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    version: STORAGE_SCHEMA_VERSION,
  })));
}

export function loadActiveProviderPresetId(presets = loadStoredProviderPresets()): string | null {
  if (typeof window === 'undefined') return presets[0]?.id ?? null;

  const saved = window.localStorage.getItem(ACTIVE_PROVIDER_PRESET_KEY);
  return presets.some(preset => preset.id === saved) ? saved : presets[0]?.id ?? null;
}

export function saveActiveProviderPresetId(presetId: string | null) {
  if (typeof window === 'undefined') return;

  if (presetId) {
    window.localStorage.setItem(ACTIVE_PROVIDER_PRESET_KEY, presetId);
  } else {
    window.localStorage.removeItem(ACTIVE_PROVIDER_PRESET_KEY);
  }
}

export async function readActiveProviderSettings(): Promise<ProviderSettings | undefined> {
  if (typeof window === 'undefined') return undefined;

  const presets = loadStoredProviderPresets();
  const activePresetId = loadActiveProviderPresetId(presets);
  const activePreset = presets.find(preset => preset.id === activePresetId);
  if (activePreset) {
    return emptyToUndefined(normalizeProviderSettings(activePreset));
  }

  return readStoredProviderSettings();
}

export function normalizeProviderSettings(settings?: ProviderSettings): ProviderSettings {
  const baseUrl = settings?.baseUrl?.trim();
  const model = settings?.model?.trim();
  const capabilities = normalizeProviderCapabilities(settings);
  const hasAttachmentOverride =
    typeof settings?.supportsAttachments === 'boolean' ||
    typeof settings?.capabilities?.supportsAttachments === 'boolean';
  const hasCapabilityMetadata = Boolean(settings?.capabilities);

  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(model ? { model } : {}),
    ...(hasAttachmentOverride ? { supportsAttachments: capabilities.supportsAttachments } : {}),
    ...(hasAttachmentOverride || hasCapabilityMetadata ? { capabilities } : {}),
  };
}

export function normalizeProviderCapabilities(settings?: ProviderSettings): ProviderCapabilities {
  const supportsAttachments = settings?.supportsAttachments ?? settings?.capabilities?.supportsAttachments ?? false;
  const supportsImages = settings?.capabilities?.supportsImages ?? supportsAttachments;
  const maxImageAttachmentBytes = positiveNumber(settings?.capabilities?.maxImageAttachmentBytes)
    ?? DEFAULT_MAX_IMAGE_ATTACHMENT_BYTES;
  const maxTextFileBytes = positiveNumber(settings?.capabilities?.maxTextFileBytes)
    ?? DEFAULT_MAX_TEXT_FILE_BYTES;

  return {
    supportsAttachments,
    supportsImages,
    maxImageAttachmentBytes,
    maxTextFileBytes,
    streaming: settings?.capabilities?.streaming ?? true,
  };
}

export function emptyToUndefined(settings: ProviderSettings): ProviderSettings | undefined {
  const hasBaseUrl = Boolean(settings.baseUrl);
  const hasModel = Boolean(settings.model);
  const hasAttachmentOverride = typeof settings.supportsAttachments === 'boolean';
  const hasCapabilities = Boolean(settings.capabilities);
  return hasBaseUrl || hasModel || hasAttachmentOverride || hasCapabilities ? settings : undefined;
}

export function validateProviderSettings(settings?: ProviderSettings): ProviderValidationResult {
  const normalized = normalizeProviderSettings(settings);

  if (normalized.baseUrl) {
    try {
      const url = new URL(normalized.baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false, message: 'Provider URL must use http or https.' };
      }
    } catch {
      return { ok: false, message: 'Provider URL must be a valid HTTP URL.' };
    }
  }

  if (normalized.model && /[\r\n\t]/.test(normalized.model)) {
    return { ok: false, message: 'Model name must be a single line.' };
  }

  return { ok: true, settings: emptyToUndefined(normalized) };
}

export function createProviderSnapshot(preset?: ProviderPreset): ProviderSnapshot {
  const normalized = normalizeProviderSettings(preset);
  return {
    id: preset?.id,
    name: preset?.name || normalized.model || 'Environment defaults',
    baseUrl: normalized.baseUrl,
    model: normalized.model,
    capabilities: normalizeProviderCapabilities(normalized),
    status: 'unchecked',
  };
}

function migrateLegacyProviderSettings(): ProviderPreset[] {
  const legacySettings = readLegacyProviderSettings();
  if (!legacySettings) return [];

  const now = Date.now();
  const preset: ProviderPreset = {
    id: createStorageId(),
    name: legacySettings.model || 'Legacy provider preset',
    ...normalizeProviderSettings(legacySettings),
    createdAt: now,
    updatedAt: now,
  };

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PROVIDER_SETTINGS_KEY);
  }
  saveProviderPresets([preset]);
  saveActiveProviderPresetId(preset.id);
  return [preset];
}

async function readStoredProviderSettings(): Promise<ProviderSettings | undefined> {
  if (typeof window === 'undefined') return undefined;

  if (window.aiChat?.getSettings) {
    return emptyToUndefined(normalizeProviderSettings(await window.aiChat.getSettings()));
  }

  return readLegacyProviderSettings();
}

function readLegacyProviderSettings(): ProviderSettings | undefined {
  const stored = readLocalJson(PROVIDER_SETTINGS_KEY, undefined) as StoredProviderSettings | undefined;
  if (!stored || isLegacyDefaultProviderSettings(stored)) return undefined;
  return emptyToUndefined(normalizeProviderSettings(stored));
}

function normalizeConversation(value: unknown): Conversation | null {
  if (!value || typeof value !== 'object') return null;
  const conversation = value as Partial<Conversation>;
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.map(normalizeMessage).filter(Boolean) as Message[]
    : [];

  if (
    typeof conversation.id !== 'string' ||
    typeof conversation.title !== 'string' ||
    typeof conversation.createdAt !== 'number' ||
    typeof conversation.updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    id: conversation.id,
    title: conversation.title,
    messages,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    ...(conversation.provider ? { provider: normalizeProviderSnapshot(conversation.provider) } : {}),
  };
}

function normalizeMessage(value: unknown): Message | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Partial<Message>;
  if (
    typeof message.id !== 'string' ||
    (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system') ||
    typeof message.content !== 'string' ||
    typeof message.timestamp !== 'number'
  ) {
    return null;
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    status: message.status ?? 'complete',
    attachments: Array.isArray(message.attachments) ? message.attachments : undefined,
  };
}

function normalizePromptTemplate(value: unknown): PromptTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const template = value as Partial<PromptTemplate>;
  if (
    typeof template.id !== 'string' ||
    typeof template.title !== 'string' ||
    typeof template.content !== 'string' ||
    typeof template.createdAt !== 'number' ||
    typeof template.updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    id: template.id,
    title: template.title,
    content: template.content,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function normalizeProviderPreset(value: unknown): ProviderPreset | null {
  if (!value || typeof value !== 'object') return null;
  const preset = value as Partial<ProviderPreset>;
  if (
    typeof preset.id !== 'string' ||
    typeof preset.name !== 'string' ||
    typeof preset.createdAt !== 'number' ||
    typeof preset.updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    id: preset.id,
    name: preset.name,
    ...normalizeProviderSettings(preset),
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  };
}

function normalizeProviderSnapshot(value: unknown): ProviderSnapshot {
  if (!value || typeof value !== 'object') {
    return createProviderSnapshot();
  }

  const snapshot = value as Partial<ProviderSnapshot>;
  return {
    id: typeof snapshot.id === 'string' ? snapshot.id : undefined,
    name: typeof snapshot.name === 'string' ? snapshot.name : 'Environment defaults',
    baseUrl: typeof snapshot.baseUrl === 'string' ? snapshot.baseUrl : undefined,
    model: typeof snapshot.model === 'string' ? snapshot.model : undefined,
    capabilities: normalizeProviderCapabilities({ capabilities: snapshot.capabilities }),
    checkedAt: typeof snapshot.checkedAt === 'number' ? snapshot.checkedAt : undefined,
    status: snapshot.status === 'reachable' || snapshot.status === 'unreachable' ? snapshot.status : 'unchecked',
  };
}

function isLegacyDefaultProviderSettings(settings: StoredProviderSettings): boolean {
  return (
    settings.version === undefined &&
    settings.baseUrl === LEGACY_DEFAULT_BASE_URL &&
    settings.model === LEGACY_DEFAULT_MODEL &&
    settings.supportsAttachments === false
  );
}

function readLocalJson(key: string, fallback: unknown): unknown {
  if (typeof window === 'undefined') return fallback;

  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    if (saved) {
      quarantineCorruptedStorage(key, saved);
    }
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function quarantineCorruptedStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(`${key}:corrupt:${Date.now()}`, value);
    console.warn(`Quarantined malformed localStorage record: ${key}`);
  } catch {
    console.warn(`Failed to quarantine malformed localStorage record: ${key}`);
  }
}
