import assert from 'node:assert/strict';
import test from 'node:test';
import { importBehaviorModule, restoreEnv } from './behavior-test-helpers.mjs';

const configModule = await importBehaviorModule('provider-config.mjs');

test('getProviderConfig throws when no API key is configured', () => {
  const snapshot = { ...process.env };

  try {
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    assert.throws(() => configModule.getProviderConfig(), /Missing API key/);
  } finally {
    restoreEnv(snapshot);
  }
});

test('getProviderConfig prefers explicit settings and trims trailing slashes', () => {
  const snapshot = { ...process.env };

  try {
    process.env.AI_API_KEY = 'env-key';
    process.env.AI_API_BASE_URL = 'https://env.example/v1';
    process.env.AI_MODEL = 'env-model';
    process.env.AI_SUPPORTS_ATTACHMENTS = 'false';

    const config = configModule.getProviderConfig({
      baseUrl: 'https://custom.example/v1///',
      model: 'custom-model',
      supportsAttachments: true,
    });

    assert.equal(config.apiKey, 'env-key');
    assert.equal(config.baseUrl, 'https://custom.example/v1');
    assert.equal(config.model, 'custom-model');
    assert.equal(config.supportsAttachments, true);
  } finally {
    restoreEnv(snapshot);
  }
});

test('getProviderConfig rejects invalid provider URLs', () => {
  const snapshot = { ...process.env };

  try {
    process.env.AI_API_KEY = 'env-key';
    assert.throws(
      () => configModule.getProviderConfig({ baseUrl: 'ftp://invalid.example' }),
      /http or https|valid HTTP URL/
    );
  } finally {
    restoreEnv(snapshot);
  }
});

test('sanitizeProviderMessage masks secrets, bearer tokens, and local paths', () => {
  const message = configModule.sanitizeProviderMessage('token=abc Bearer xyz C:\\Users\\me\\secret.txt /Users/me/tmp sk-test');

  assert.match(message, /token=\*\*\*/);
  assert.match(message, /Bearer \*\*\*/);
  assert.match(message, /\[local path\]/);
  assert.match(message, /sk-\*\*\*/);
});
