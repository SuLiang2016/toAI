import assert from 'node:assert/strict';
import test from 'node:test';
import { importBehaviorModule, installWindowMock } from './behavior-test-helpers.mjs';

const storage = await importBehaviorModule('storage.mjs');
const FIXED_CREATED_AT = '2026-05-20T05:00:00.000Z';

function createBackupEnvelope(overrides = {}) {
  return {
    backupFormatVersion: storage.BACKUP_FORMAT_VERSION,
    storageSchemaVersion: storage.STORAGE_SCHEMA_VERSION,
    createdAt: FIXED_CREATED_AT,
    localStorage: {
      conversations: [
        {
          id: 'conv-1',
          title: 'Recovered conversation',
          createdAt: 11,
          updatedAt: 22,
          messages: [
            { id: 'msg-1', role: 'user', content: 'hello', timestamp: 33 },
            { id: 'msg-2', role: 'assistant', content: 'world', timestamp: 44, status: 'complete' },
          ],
        },
      ],
      activeConversationId: 'conv-1',
      locale: 'en',
      conversationDrafts: {
        'conv-1': 'draft text',
      },
      newConversationDraft: 'fresh draft',
      promptTemplates: [
        {
          id: 'tpl-1',
          title: 'Template',
          content: 'Template body',
          createdAt: 55,
          updatedAt: 66,
        },
      ],
      providerPresets: [
        {
          id: 'preset-1',
          name: 'Recovered preset',
          baseUrl: 'https://provider.example/v1',
          model: 'gpt-x',
          supportsAttachments: true,
          capabilities: {
            supportsAttachments: true,
            supportsImages: true,
            maxImageAttachmentBytes: 1024,
            maxTextFileBytes: 2048,
            streaming: true,
          },
          createdAt: 77,
          updatedAt: 88,
        },
      ],
      activeProviderPresetId: 'preset-1',
      legacyProviderSettings: {
        baseUrl: 'https://legacy.example/v1',
        model: 'legacy-model',
        supportsAttachments: false,
      },
    },
    ...overrides,
  };
}

function seedCurrentAppState(windowMock) {
  windowMock.localStorage.setItem(storage.CONVERSATIONS_KEY, JSON.stringify([
    {
      id: 'old-conv',
      title: 'Old conversation',
      createdAt: 1,
      updatedAt: 2,
      messages: [
        { id: 'old-msg', role: 'user', content: 'old', timestamp: 3 },
      ],
    },
  ]));
  windowMock.localStorage.setItem(storage.ACTIVE_CONVERSATION_KEY, 'old-conv');
  windowMock.localStorage.setItem(storage.LOCALE_PREFERENCE_KEY, 'en');
  windowMock.localStorage.setItem(storage.CONVERSATION_DRAFTS_KEY, JSON.stringify({ 'old-conv': 'old draft' }));
  windowMock.localStorage.setItem(storage.NEW_CONVERSATION_DRAFT_KEY, 'old new draft');
  windowMock.localStorage.setItem(storage.PROMPT_TEMPLATES_KEY, JSON.stringify([
    { id: 'old-tpl', title: 'Old', content: 'Old body', createdAt: 4, updatedAt: 5 },
  ]));
  windowMock.localStorage.setItem(storage.PROVIDER_PRESETS_KEY, JSON.stringify([
    { id: 'old-preset', name: 'Old preset', baseUrl: 'https://old.example/v1', model: 'old-model', createdAt: 6, updatedAt: 7 },
  ]));
  windowMock.localStorage.setItem(storage.ACTIVE_PROVIDER_PRESET_KEY, 'old-preset');
  windowMock.localStorage.setItem(storage.PROVIDER_SETTINGS_KEY, JSON.stringify({
    baseUrl: 'https://old-legacy.example/v1',
    model: 'old-legacy',
    supportsAttachments: false,
  }));
}

function assertEntriesUnchanged(windowMock, before) {
  assert.deepEqual(windowMock.entries(), before);
}

test('loadStoredConversations returns normalized conversations and drops malformed records', () => {
  const windowMock = installWindowMock();

  try {
    windowMock.localStorage.setItem(storage.CONVERSATIONS_KEY, JSON.stringify([
      {
        id: 'conv-1',
        title: 'First',
        createdAt: 1,
        updatedAt: 2,
        messages: [
          { id: 'msg-1', role: 'user', content: 'hello', timestamp: 3 },
          { id: 'msg-2', role: 'assistant', content: 'world', timestamp: 4, status: 'partial' },
        ],
      },
      { id: 42, title: 'bad' },
    ]));

    const conversations = storage.loadStoredConversations();

    assert.equal(conversations.length, 1);
    assert.equal(conversations[0].messages.length, 2);
    assert.equal(conversations[0].messages[1].status, 'partial');
  } finally {
    windowMock.restore();
  }
});

test('loadStoredConversations quarantines malformed JSON', () => {
  const windowMock = installWindowMock();

  try {
    windowMock.localStorage.setItem(storage.CONVERSATIONS_KEY, '{bad-json');
    const conversations = storage.loadStoredConversations();
    const entries = windowMock.entries();

    assert.deepEqual(conversations, []);
    assert.ok(Object.keys(entries).some(key => key.startsWith(`${storage.CONVERSATIONS_KEY}:corrupt:`)));
  } finally {
    windowMock.restore();
  }
});

test('loadStoredConversations preserves legacy records while defaulting new organization fields', () => {
  const windowMock = installWindowMock();

  try {
    windowMock.localStorage.setItem(storage.CONVERSATIONS_KEY, JSON.stringify([
      {
        id: 'legacy-conv',
        title: 'Legacy conversation',
        createdAt: 1,
        updatedAt: 2,
        messages: [
          { id: 'legacy-msg', role: 'assistant', content: 'legacy', timestamp: 3 },
        ],
        provider: {
          name: 'Legacy provider',
          model: 'legacy-model',
        },
      },
    ]));

    const conversations = storage.loadStoredConversations();
    assert.equal(conversations.length, 1);
    assert.equal(conversations[0].pinned, false);
    assert.equal(conversations[0].archived, false);
    assert.equal(conversations[0].provider?.status, 'unchecked');
    assert.equal(conversations[0].provider?.capabilities.streaming, true);
  } finally {
    windowMock.restore();
  }
});

test('saveConversations preserves explicit message status values', () => {
  const windowMock = installWindowMock();

  try {
    storage.saveConversations([
      {
        id: 'conv-1',
        title: 'First',
        createdAt: 1,
        updatedAt: 2,
        messages: [
          { id: 'msg-1', role: 'assistant', content: 'partial reply', timestamp: 3, status: 'partial' },
        ],
      },
    ]);

    const persisted = JSON.parse(windowMock.localStorage.getItem(storage.CONVERSATIONS_KEY));
    assert.equal(persisted[0].messages[0].status, 'partial');
  } finally {
    windowMock.restore();
  }
});

test('pruneConversationDrafts removes drafts for missing conversations', () => {
  const windowMock = installWindowMock();

  try {
    windowMock.localStorage.setItem(storage.CONVERSATION_DRAFTS_KEY, JSON.stringify({
      keep: 'draft-1',
      drop: 'draft-2',
    }));

    const removed = storage.pruneConversationDrafts(['keep']);
    const persisted = JSON.parse(windowMock.localStorage.getItem(storage.CONVERSATION_DRAFTS_KEY));

    assert.equal(removed, 1);
    assert.deepEqual(persisted, { keep: 'draft-1' });
  } finally {
    windowMock.restore();
  }
});

test('loadStoredProviderPresets migrates legacy provider settings into presets', () => {
  const windowMock = installWindowMock();

  try {
    windowMock.localStorage.setItem(storage.PROVIDER_SETTINGS_KEY, JSON.stringify({
      baseUrl: 'https://provider.example/v1',
      model: 'gpt-x',
      supportsAttachments: true,
    }));

    const presets = storage.loadStoredProviderPresets();
    const migrated = JSON.parse(windowMock.localStorage.getItem(storage.PROVIDER_PRESETS_KEY));

    assert.equal(presets.length, 1);
    assert.equal(presets[0].model, 'gpt-x');
    assert.equal(windowMock.localStorage.getItem(storage.PROVIDER_SETTINGS_KEY), null);
    assert.equal(migrated.length, 1);
  } finally {
    windowMock.restore();
  }
});

test('loadStoredProviderPresets defaults capability metadata and check status for legacy presets', () => {
  const windowMock = installWindowMock();

  try {
    windowMock.localStorage.setItem(storage.PROVIDER_PRESETS_KEY, JSON.stringify([
      {
        id: 'legacy-preset',
        name: 'Legacy preset',
        baseUrl: 'https://legacy.example/v1',
        model: 'legacy-model',
        supportsAttachments: true,
        createdAt: 10,
        updatedAt: 11,
      },
    ]));

    const presets = storage.loadStoredProviderPresets();
    assert.equal(presets.length, 1);
    assert.equal(presets[0].capabilities.supportsAttachments, true);
    assert.equal(presets[0].capabilities.supportsImages, true);
    assert.equal(presets[0].lastCheckStatus, 'unchecked');
  } finally {
    windowMock.restore();
  }
});

test('validateProviderSettings rejects non-http URLs and multiline model names', () => {
  const invalidProtocol = storage.validateProviderSettings({ baseUrl: 'ftp://example.com' });
  const multilineModel = storage.validateProviderSettings({ model: 'gpt\nbad' });

  assert.equal(invalidProtocol.ok, false);
  assert.equal(multilineModel.ok, false);
});

test('saveStoredLocale syncs localStorage and cookie while loadStoredLocale respects the stored value', () => {
  const windowMock = installWindowMock();

  try {
    assert.equal(storage.loadStoredLocale(), 'zh-CN');

    storage.saveStoredLocale('en');
    assert.equal(storage.loadStoredLocale(), 'en');
    assert.equal(windowMock.localStorage.getItem(storage.LOCALE_PREFERENCE_KEY), 'en');
    assert.equal(windowMock.cookies()['ai-chat-locale'], 'en');

    storage.saveStoredLocale(null);
    assert.equal(storage.loadStoredLocale(), 'zh-CN');
    assert.equal(windowMock.localStorage.getItem(storage.LOCALE_PREFERENCE_KEY), null);
    assert.equal(windowMock.cookies()['ai-chat-locale'], undefined);
  } finally {
    windowMock.restore();
  }
});

test('createProviderSnapshot defaults missing provider data without secrets', () => {
  const snapshot = storage.createProviderSnapshot();

  assert.equal(snapshot.name, 'Environment defaults');
  assert.equal(snapshot.status, 'unchecked');
  assert.equal(snapshot.capabilities.streaming, true);
  assert.equal('apiKey' in snapshot, false);
});

test('exportAppBackup returns a deterministic versioned envelope for app-owned local data', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    windowMock.localStorage.setItem('window-state', '{"width":1200}');

    const firstBackup = storage.exportAppBackup(FIXED_CREATED_AT);
    const secondBackup = storage.exportAppBackup(FIXED_CREATED_AT);

    assert.deepEqual(Object.keys(firstBackup), [
      'backupFormatVersion',
      'storageSchemaVersion',
      'createdAt',
      'localStorage',
    ]);
    assert.deepEqual(Object.keys(firstBackup.localStorage), [
      'conversations',
      'activeConversationId',
      'locale',
      'conversationDrafts',
      'newConversationDraft',
      'promptTemplates',
      'providerPresets',
      'activeProviderPresetId',
      'legacyProviderSettings',
    ]);
    assert.equal(firstBackup.localStorage.activeConversationId, 'old-conv');
    assert.equal(firstBackup.localStorage.locale, 'en');
    assert.equal(firstBackup.localStorage.activeProviderPresetId, 'old-preset');
    assert.equal(firstBackup.localStorage.legacyProviderSettings.model, 'old-legacy');
    assert.equal('window-state' in firstBackup.localStorage, false);
    assert.equal(JSON.stringify(firstBackup), JSON.stringify(secondBackup));
  } finally {
    windowMock.restore();
  }
});

test('exportAppBackup rejects malformed provider preset records instead of silently dropping them', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    windowMock.localStorage.setItem(storage.PROVIDER_PRESETS_KEY, JSON.stringify([
      { id: 'broken-preset' },
    ]));

    assert.throws(() => storage.exportAppBackup(FIXED_CREATED_AT), /providerPresets/);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup replaces app-owned state and leaves unrelated keys untouched', () => {
  const windowMock = installWindowMock({
    'window-state': '{"width":1200}',
  });

  try {
    seedCurrentAppState(windowMock);
    const backup = createBackupEnvelope({
      localStorage: {
        ...createBackupEnvelope().localStorage,
        conversationDrafts: {},
        newConversationDraft: '',
        legacyProviderSettings: null,
      },
    });

    storage.restoreAppBackup(backup);

    assert.deepEqual(
      JSON.parse(windowMock.localStorage.getItem(storage.CONVERSATIONS_KEY)),
      backup.localStorage.conversations.map(conversation => ({
        ...conversation,
        pinned: conversation.pinned ?? false,
        archived: conversation.archived ?? false,
        messages: conversation.messages.map(message => ({
          ...message,
          status: message.status ?? 'complete',
        })),
      }))
    );
    assert.equal(windowMock.localStorage.getItem(storage.ACTIVE_CONVERSATION_KEY), 'conv-1');
    assert.equal(windowMock.localStorage.getItem(storage.LOCALE_PREFERENCE_KEY), 'en');
    assert.equal(windowMock.cookies()['ai-chat-locale'], 'en');
    assert.equal(windowMock.localStorage.getItem(storage.CONVERSATION_DRAFTS_KEY), null);
    assert.equal(windowMock.localStorage.getItem(storage.NEW_CONVERSATION_DRAFT_KEY), null);
    assert.deepEqual(
      JSON.parse(windowMock.localStorage.getItem(storage.PROMPT_TEMPLATES_KEY)),
      backup.localStorage.promptTemplates.map(template => ({ ...template, version: storage.STORAGE_SCHEMA_VERSION }))
    );
    assert.deepEqual(
      JSON.parse(windowMock.localStorage.getItem(storage.PROVIDER_PRESETS_KEY)),
      backup.localStorage.providerPresets.map(preset => ({
        ...preset,
        lastCheckStatus: preset.lastCheckStatus ?? 'unchecked',
        version: storage.STORAGE_SCHEMA_VERSION,
      }))
    );
    assert.equal(windowMock.localStorage.getItem(storage.ACTIVE_PROVIDER_PRESET_KEY), 'preset-1');
    assert.equal(windowMock.localStorage.getItem(storage.PROVIDER_SETTINGS_KEY), null);
    assert.equal(windowMock.localStorage.getItem('window-state'), '{"width":1200}');
  } finally {
    windowMock.restore();
  }
});

test('parseAppBackupJson rejects malformed JSON without mutating current state', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    const before = windowMock.entries();

    assert.throws(() => storage.parseAppBackupJson('{bad-json'), /valid JSON/);
    assertEntriesUnchanged(windowMock, before);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup rejects unsupported backup versions without mutating current state', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    const before = windowMock.entries();

    assert.throws(() => storage.restoreAppBackup(createBackupEnvelope({
      backupFormatVersion: storage.BACKUP_FORMAT_VERSION + 1,
    })), /Backup format version/);
    assertEntriesUnchanged(windowMock, before);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup rejects unsupported storage schema versions without mutating current state', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    const before = windowMock.entries();

    assert.throws(() => storage.restoreAppBackup(createBackupEnvelope({
      storageSchemaVersion: storage.STORAGE_SCHEMA_VERSION + 1,
    })), /Storage schema version/);
    assertEntriesUnchanged(windowMock, before);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup rejects unsupported electronProviderSettings without mutating current state', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    const before = windowMock.entries();

    assert.throws(() => storage.restoreAppBackup({
      ...createBackupEnvelope(),
      electronProviderSettings: {
        baseUrl: 'https://desktop.example/v1',
        model: 'desktop-model',
      },
    }), /not supported/);
    assertEntriesUnchanged(windowMock, before);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup rejects missing required sections without mutating current state', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    const before = windowMock.entries();
    const backup = createBackupEnvelope();
    delete backup.localStorage.promptTemplates;

    assert.throws(() => storage.restoreAppBackup(backup), /promptTemplates/);
    assertEntriesUnchanged(windowMock, before);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup rejects broken active conversation references without mutating current state', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    const before = windowMock.entries();

    assert.throws(() => storage.restoreAppBackup(createBackupEnvelope({
      localStorage: {
        ...createBackupEnvelope().localStorage,
        activeConversationId: 'missing-conversation',
      },
    })), /activeConversationId/);
    assertEntriesUnchanged(windowMock, before);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup rejects draft references to missing conversations without mutating current state', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    const before = windowMock.entries();

    assert.throws(() => storage.restoreAppBackup(createBackupEnvelope({
      localStorage: {
        ...createBackupEnvelope().localStorage,
        conversationDrafts: {
          missing: 'orphaned draft',
        },
      },
    })), /conversationDrafts/);
    assertEntriesUnchanged(windowMock, before);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup rejects broken active provider preset references without mutating current state', () => {
  const windowMock = installWindowMock();

  try {
    seedCurrentAppState(windowMock);
    const before = windowMock.entries();

    assert.throws(() => storage.restoreAppBackup(createBackupEnvelope({
      localStorage: {
        ...createBackupEnvelope().localStorage,
        activeProviderPresetId: 'missing-preset',
      },
    })), /activeProviderPresetId/);
    assertEntriesUnchanged(windowMock, before);
  } finally {
    windowMock.restore();
  }
});

test('restoreAppBackup rolls back app-owned keys after a mid-restore write failure', () => {
  const windowMock = installWindowMock({
    'window-state': '{"width":1200}',
  });

  try {
    seedCurrentAppState(windowMock);
    windowMock.localStorage.removeItem(storage.NEW_CONVERSATION_DRAFT_KEY);
    const before = windowMock.entries();
    const originalSetItem = windowMock.localStorage.setItem.bind(windowMock.localStorage);
    let failed = false;

    windowMock.localStorage.setItem = (key, value) => {
      if (!failed && key === storage.PROMPT_TEMPLATES_KEY) {
        failed = true;
        throw new Error('simulated write failure');
      }
      originalSetItem(key, value);
    };

    assert.throws(() => storage.restoreAppBackup(createBackupEnvelope()), /rolled back/);
    assertEntriesUnchanged(windowMock, before);
    assert.equal(windowMock.localStorage.getItem('window-state'), '{"width":1200}');
  } finally {
    windowMock.restore();
  }
});

test('getStorageHealthSummary reports oversized local data and quarantined records', () => {
  const windowMock = installWindowMock();

  try {
    windowMock.localStorage.setItem(storage.CONVERSATIONS_KEY, JSON.stringify([
      {
        id: 'conv-big',
        title: 'Big conversation',
        createdAt: 1,
        updatedAt: 2,
        messages: [
          { id: 'msg-big', role: 'user', content: 'x'.repeat(2_300_000), timestamp: 3 },
        ],
      },
    ]));
    windowMock.localStorage.setItem(`${storage.CONVERSATIONS_KEY}:corrupt:1`, '{"broken":true}');

    const summary = storage.getStorageHealthSummary();
    assert.equal(summary.overSoftLimit, true);
    assert.equal(summary.quarantinedRecordCount, 1);
    assert.ok(summary.appDataBytes > summary.softLimitBytes);
  } finally {
    windowMock.restore();
  }
});
