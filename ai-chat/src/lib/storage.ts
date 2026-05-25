import type {
  AppLocale,
  Conversation,
  Message,
  PromptTemplate,
  ProviderCapabilities,
  ProviderPreset,
  ProviderReachabilityStatus,
  ProviderSettings,
  ProviderSnapshot,
} from '@/types/chat';
import { DEFAULT_LOCALE, getMessage, isLocale, LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY } from '@/i18n';

export const STORAGE_SCHEMA_VERSION = 2;
export const BACKUP_FORMAT_VERSION = 1;
export const CONVERSATIONS_KEY = 'conversations';
export const ACTIVE_CONVERSATION_KEY = 'currentConversationId';
export const CONVERSATION_DRAFTS_KEY = 'conversationDrafts';
export const NEW_CONVERSATION_DRAFT_KEY = 'newConversationDraft';
export const PROMPT_TEMPLATES_KEY = 'promptTemplates';
export const PROVIDER_PRESETS_KEY = 'providerPresets';
export const ACTIVE_PROVIDER_PRESET_KEY = 'activeProviderPresetId';
export const PROVIDER_SETTINGS_KEY = 'providerSettings';
export const LOCALE_PREFERENCE_KEY = LOCALE_STORAGE_KEY;

const LEGACY_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const LEGACY_DEFAULT_MODEL = 'gpt-3.5-turbo';
const DEFAULT_MAX_IMAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_TEXT_FILE_BYTES = 256 * 1024;
const STORAGE_SOFT_LIMIT_BYTES = 2 * 1024 * 1024;

type StoredProviderSettings = ProviderSettings & {
  version?: number;
};

export interface ProviderValidationResult {
  ok: boolean;
  settings?: ProviderSettings;
  message?: string;
}

export interface AppBackupLocalStorage {
  conversations: Conversation[];
  activeConversationId: string | null;
  locale: AppLocale | null;
  conversationDrafts: Record<string, string>;
  newConversationDraft: string;
  promptTemplates: PromptTemplate[];
  providerPresets: ProviderPreset[];
  activeProviderPresetId: string | null;
  legacyProviderSettings: ProviderSettings | null;
}

export interface AppBackupEnvelope {
  backupFormatVersion: number;
  storageSchemaVersion: number;
  createdAt: string;
  localStorage: AppBackupLocalStorage;
}

export interface StorageHealthSummary {
  appDataBytes: number;
  softLimitBytes: number;
  overSoftLimit: boolean;
  quarantinedRecordCount: number;
}

type StorageSnapshot = Record<string, string | null>;

const APP_OWNED_STORAGE_KEYS = [
  CONVERSATIONS_KEY,
  ACTIVE_CONVERSATION_KEY,
  CONVERSATION_DRAFTS_KEY,
  NEW_CONVERSATION_DRAFT_KEY,
  LOCALE_PREFERENCE_KEY,
  PROMPT_TEMPLATES_KEY,
  PROVIDER_PRESETS_KEY,
  ACTIVE_PROVIDER_PRESET_KEY,
  PROVIDER_SETTINGS_KEY,
] as const;

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
    messages: conversation.messages.map(message => ({ ...message, status: message.status ?? 'complete' })),
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

export function loadStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_PREFERENCE_KEY);
    return isLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function saveStoredLocale(locale: AppLocale | null) {
  if (typeof window === 'undefined') return;

  if (!locale) {
    window.localStorage.removeItem(LOCALE_PREFERENCE_KEY);
    document.cookie = `${LOCALE_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    return;
  }

  window.localStorage.setItem(LOCALE_PREFERENCE_KEY, locale);
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax`;
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
    ...(typeof preset.lastCheckedAt === 'number' ? { lastCheckedAt: preset.lastCheckedAt } : {}),
    ...(preset.lastCheckStatus ? { lastCheckStatus: preset.lastCheckStatus } : {}),
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

export function validateProviderSettings(settings?: ProviderSettings, locale: AppLocale = 'en'): ProviderValidationResult {
  const normalized = normalizeProviderSettings(settings);

  if (normalized.baseUrl) {
    try {
      const url = new URL(normalized.baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false, message: getMessage(locale, 'provider.urlProtocol') };
      }
    } catch {
      return { ok: false, message: getMessage(locale, 'provider.urlInvalid') };
    }
  }

  if (normalized.model && /[\r\n\t]/.test(normalized.model)) {
    return { ok: false, message: getMessage(locale, 'provider.modelSingleLine') };
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
    checkedAt: preset?.lastCheckedAt,
    status: preset?.lastCheckStatus ?? 'unchecked',
  };
}

export function getStorageHealthSummary(): StorageHealthSummary {
  const appDataBytes = estimateAppOwnedStorageBytes();
  const quarantinedRecordCount = countQuarantinedStorageRecords();

  return {
    appDataBytes,
    softLimitBytes: STORAGE_SOFT_LIMIT_BYTES,
    overSoftLimit: appDataBytes > STORAGE_SOFT_LIMIT_BYTES,
    quarantinedRecordCount,
  };
}

export function exportAppBackup(createdAt = new Date().toISOString()): AppBackupEnvelope {
  const conversations = readStoredConversationsForBackup();
  const providerPresets = readStoredProviderPresetsForBackup();

  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    createdAt,
    localStorage: {
      conversations,
      activeConversationId: normalizeActiveConversationId(readStoredString(ACTIVE_CONVERSATION_KEY), conversations),
      locale: readStoredLocaleForBackup(),
      conversationDrafts: filterConversationDrafts(readStoredConversationDraftsForBackup(), conversations),
      newConversationDraft: readStoredString(NEW_CONVERSATION_DRAFT_KEY) ?? '',
      promptTemplates: readStoredPromptTemplatesForBackup(),
      providerPresets,
      activeProviderPresetId: normalizeActiveProviderPresetId(readStoredString(ACTIVE_PROVIDER_PRESET_KEY), providerPresets),
      legacyProviderSettings: readLegacyProviderSettingsForBackup(),
    },
  };
}

export function parseAppBackupJson(serializedBackup: string): AppBackupEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serializedBackup);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  return validateAppBackupEnvelope(parsed);
}

export function validateAppBackupEnvelope(value: unknown): AppBackupEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Backup file must be a JSON object.');
  }

  const backup = value as Record<string, unknown>;

  if (backup.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(`Backup format version ${String(backup.backupFormatVersion)} is not supported.`);
  }

  if (backup.storageSchemaVersion !== STORAGE_SCHEMA_VERSION) {
    throw new Error(`Storage schema version ${String(backup.storageSchemaVersion)} is not supported.`);
  }

  if (typeof backup.createdAt !== 'string' || Number.isNaN(Date.parse(backup.createdAt))) {
    throw new Error('Backup file must include a valid createdAt timestamp.');
  }

  const localStorage = validateBackupLocalStorage(backup.localStorage);
  const nextBackup: AppBackupEnvelope = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    createdAt: backup.createdAt,
    localStorage,
  };

  if ('electronProviderSettings' in backup) {
    throw new Error('electronProviderSettings is not supported in this build.');
  }

  return nextBackup;
}

export function restoreAppBackup(backup: AppBackupEnvelope) {
  if (typeof window === 'undefined') return;

  const validatedBackup = validateAppBackupEnvelope(backup);
  const snapshot = snapshotStorageKeys(APP_OWNED_STORAGE_KEYS);

  try {
    applyBackupLocalStorage(validatedBackup.localStorage);
  } catch (error) {
    try {
      restoreStorageSnapshot(snapshot);
    } catch {
      throw new Error('Backup restore failed and rollback could not restore the original data.');
    }

    const message = error instanceof Error ? error.message : 'Unknown localStorage write error.';
    throw new Error(`Backup restore failed and was rolled back: ${message}`);
  }
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

function readLegacyProviderSettingsForBackup(): ProviderSettings | null {
  const stored = readStoredJsonForBackup(PROVIDER_SETTINGS_KEY);
  if (stored === undefined || stored === null) return null;

  const validation = validateOptionalProviderSettings(stored, 'localStorage.legacyProviderSettings');
  return isLegacyDefaultProviderSettings(validation as StoredProviderSettings) ? null : validation;
}

function readStoredLocaleForBackup(): AppLocale | null {
  const storedLocale = readStoredString(LOCALE_PREFERENCE_KEY);
  return isLocale(storedLocale) ? storedLocale : null;
}

function validateBackupLocalStorage(value: unknown): AppBackupLocalStorage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Backup file must include a localStorage object.');
  }

  const localStorage = value as Record<string, unknown>;
  const conversations = validateConversationList(localStorage.conversations);
  const activeConversationId = validateNullableString(localStorage.activeConversationId, 'activeConversationId');
  const locale = validateOptionalLocale(localStorage.locale, 'locale');
  const conversationDrafts = validateDraftMap(localStorage.conversationDrafts);
  const newConversationDraft = validateRequiredString(localStorage.newConversationDraft, 'newConversationDraft');
  const promptTemplates = validatePromptTemplateList(localStorage.promptTemplates);
  const providerPresets = validateProviderPresetList(localStorage.providerPresets);
  const activeProviderPresetId = validateNullableString(localStorage.activeProviderPresetId, 'activeProviderPresetId');
  const legacyProviderSettings = validateOptionalProviderSettings(
    localStorage.legacyProviderSettings,
    'legacyProviderSettings'
  );

  const conversationIds = new Set(conversations.map(conversation => conversation.id));
  if (activeConversationId && !conversationIds.has(activeConversationId)) {
    throw new Error('activeConversationId must reference an imported conversation.');
  }

  for (const draftConversationId of Object.keys(conversationDrafts)) {
    if (!conversationIds.has(draftConversationId)) {
      throw new Error('conversationDrafts must reference imported conversations only.');
    }
  }

  const providerPresetIds = new Set(providerPresets.map(preset => preset.id));
  if (activeProviderPresetId && !providerPresetIds.has(activeProviderPresetId)) {
    throw new Error('activeProviderPresetId must reference an imported provider preset.');
  }

  return {
    conversations,
    activeConversationId,
    locale,
    conversationDrafts,
    newConversationDraft,
    promptTemplates,
    providerPresets,
    activeProviderPresetId,
    legacyProviderSettings,
  };
}

function validateOptionalLocale(value: unknown, fieldName: string): AppLocale | null {
  if (value === undefined || value === null) return null;
  if (!isLocale(value)) {
    throw new Error(`${fieldName} must be "zh-CN", "en", or null.`);
  }

  return value;
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
    pinned: conversation.pinned === true,
    archived: conversation.archived === true,
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
    lastCheckedAt: typeof preset.lastCheckedAt === 'number' ? preset.lastCheckedAt : undefined,
    lastCheckStatus: normalizeReachabilityStatus(preset.lastCheckStatus),
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
    status: normalizeReachabilityStatus(snapshot.status),
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

function readStoredConversationsForBackup(): Conversation[] {
  const parsed = readStoredJsonForBackup(CONVERSATIONS_KEY);
  return parsed === undefined ? [] : validateConversationList(parsed);
}

function readStoredConversationDraftsForBackup(): Record<string, string> {
  const parsed = readStoredJsonForBackup(CONVERSATION_DRAFTS_KEY);
  return parsed === undefined ? {} : validateDraftMap(parsed);
}

function readStoredPromptTemplatesForBackup(): PromptTemplate[] {
  const parsed = readStoredJsonForBackup(PROMPT_TEMPLATES_KEY);
  return parsed === undefined ? [] : validatePromptTemplateList(parsed);
}

function readStoredProviderPresetsForBackup(): ProviderPreset[] {
  const parsed = readStoredJsonForBackup(PROVIDER_PRESETS_KEY);
  return parsed === undefined ? [] : validateProviderPresetList(parsed);
}

function readStoredJsonForBackup(key: string): unknown {
  const saved = readStoredValue(key);
  if (saved === null) return undefined;

  try {
    return JSON.parse(saved);
  } catch {
    throw new Error(`Stored ${key} data is malformed and cannot be exported.`);
  }
}

function validateConversationList(value: unknown): Conversation[] {
  if (!Array.isArray(value)) {
    throw new Error('localStorage.conversations must be an array.');
  }

  const conversations = value.map(normalizeConversation).filter(Boolean) as Conversation[];
  if (conversations.length !== value.length) {
    throw new Error('localStorage.conversations contains invalid records.');
  }

  return conversations;
}

function validatePromptTemplateList(value: unknown): PromptTemplate[] {
  if (!Array.isArray(value)) {
    throw new Error('localStorage.promptTemplates must be an array.');
  }

  const templates = value.map(normalizePromptTemplate).filter(Boolean) as PromptTemplate[];
  if (templates.length !== value.length) {
    throw new Error('localStorage.promptTemplates contains invalid records.');
  }

  return templates;
}

function validateProviderPresetList(value: unknown): ProviderPreset[] {
  if (!Array.isArray(value)) {
    throw new Error('localStorage.providerPresets must be an array.');
  }

  const presets = value.map(normalizeProviderPreset).filter(Boolean) as ProviderPreset[];
  if (presets.length !== value.length) {
    throw new Error('localStorage.providerPresets contains invalid records.');
  }

  return presets;
}

function validateDraftMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('localStorage.conversationDrafts must be an object.');
  }

  const entries = Object.entries(value);
  if (!entries.every(([key, draft]) => typeof key === 'string' && typeof draft === 'string')) {
    throw new Error('localStorage.conversationDrafts must contain only string values.');
  }

  return Object.fromEntries(entries);
}

function validateNullableString(value: unknown, fieldName: string): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new Error(`${fieldName} must be a string or null.`);
}

function validateRequiredString(value: unknown, fieldName: string): string {
  if (typeof value === 'string') return value;
  throw new Error(`${fieldName} must be a string.`);
}

function validateOptionalProviderSettings(value: unknown, fieldName: string): ProviderSettings | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be a provider settings object or null.`);
  }

  const validation = validateProviderSettings(value as ProviderSettings);
  if (!validation.ok || !validation.settings) {
    throw new Error(validation.message || `${fieldName} is invalid.`);
  }

  return validation.settings;
}

function applyBackupLocalStorage(localStorage: AppBackupLocalStorage) {
  saveConversations(localStorage.conversations);
  saveActiveConversationId(localStorage.activeConversationId);
  saveStoredLocale(localStorage.locale);
  saveConversationDrafts(localStorage.conversationDrafts);
  saveDraftForConversation(null, localStorage.newConversationDraft);
  savePromptTemplates(localStorage.promptTemplates);
  saveProviderPresets(localStorage.providerPresets);
  saveActiveProviderPresetId(localStorage.activeProviderPresetId);
  saveLegacyProviderSettings(localStorage.legacyProviderSettings);
}

function saveLegacyProviderSettings(settings: ProviderSettings | null) {
  if (typeof window === 'undefined') return;

  if (!settings) {
    window.localStorage.removeItem(PROVIDER_SETTINGS_KEY);
    return;
  }

  writeLocalJson(PROVIDER_SETTINGS_KEY, settings);
}

function snapshotStorageKeys(keys: readonly string[]): StorageSnapshot {
  const snapshot: StorageSnapshot = {};

  for (const key of keys) {
    snapshot[key] = readStoredValue(key);
  }

  return snapshot;
}

function restoreStorageSnapshot(snapshot: StorageSnapshot) {
  if (typeof window === 'undefined') return;

  for (const [key, value] of Object.entries(snapshot)) {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  }
}

function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredString(key: string): string | null {
  const value = readStoredValue(key);
  return typeof value === 'string' ? value : null;
}

function normalizeActiveConversationId(activeConversationId: string | null, conversations: Conversation[]): string | null {
  return conversations.some(conversation => conversation.id === activeConversationId) ? activeConversationId : null;
}

function normalizeActiveProviderPresetId(activeProviderPresetId: string | null, presets: ProviderPreset[]): string | null {
  return presets.some(preset => preset.id === activeProviderPresetId) ? activeProviderPresetId : null;
}

function filterConversationDrafts(
  drafts: Record<string, string>,
  conversations: Conversation[]
): Record<string, string> {
  const conversationIds = new Set(conversations.map(conversation => conversation.id));
  return Object.fromEntries(
    Object.entries(drafts).filter(([conversationId]) => conversationIds.has(conversationId))
  );
}

function normalizeReachabilityStatus(value: unknown): ProviderReachabilityStatus {
  return value === 'reachable' || value === 'unreachable' ? value : 'unchecked';
}

function estimateAppOwnedStorageBytes(): number {
  return APP_OWNED_STORAGE_KEYS.reduce((total, key) => {
    const value = readStoredValue(key);
    return total + estimateStorageEntryBytes(key, value);
  }, 0);
}

function countQuarantinedStorageRecords(): number {
  if (typeof window === 'undefined') return 0;

  let count = 0;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && APP_OWNED_STORAGE_KEYS.some(prefix => key.startsWith(`${prefix}:corrupt:`))) {
        count += 1;
      }
    }
  } catch {
    return 0;
  }

  return count;
}

function estimateStorageEntryBytes(key: string, value: string | null): number {
  if (value === null) return 0;
  return key.length + value.length;
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
