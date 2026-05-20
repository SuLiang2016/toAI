import assert from 'node:assert/strict';
import test from 'node:test';
import { importBehaviorModule, installWindowMock } from './behavior-test-helpers.mjs';

const storage = await importBehaviorModule('storage.mjs');

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

test('validateProviderSettings rejects non-http URLs and multiline model names', () => {
  const invalidProtocol = storage.validateProviderSettings({ baseUrl: 'ftp://example.com' });
  const multilineModel = storage.validateProviderSettings({ model: 'gpt\nbad' });

  assert.equal(invalidProtocol.ok, false);
  assert.equal(multilineModel.ok, false);
});

test('createProviderSnapshot defaults missing provider data without secrets', () => {
  const snapshot = storage.createProviderSnapshot();

  assert.equal(snapshot.name, 'Environment defaults');
  assert.equal(snapshot.status, 'unchecked');
  assert.equal(snapshot.capabilities.streaming, true);
  assert.equal('apiKey' in snapshot, false);
});
