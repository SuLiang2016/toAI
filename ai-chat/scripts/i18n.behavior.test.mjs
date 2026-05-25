import assert from 'node:assert/strict';
import test from 'node:test';
import { importBehaviorModule, installWindowMock } from './behavior-test-helpers.mjs';

const i18n = await importBehaviorModule('i18n-lite.mjs');
const enMessages = await importBehaviorModule('i18n-messages-en.mjs');
const zhCNMessages = await importBehaviorModule('i18n-messages-zh-CN.mjs');

test('zh-CN and en message catalogs stay key-identical', () => {
  assert.deepEqual(
    Object.keys(zhCNMessages.zhCNMessages).sort(),
    Object.keys(enMessages.enMessages).sort()
  );
});

test('readLocaleFromBrowser prefers cookie, then localStorage, then dataset/html/default locale', () => {
  let windowMock = installWindowMock({ locale: 'en' }, { cookie: 'ai-chat-locale=zh-CN', lang: 'en', datasetLocale: 'en' });

  try {
    assert.equal(i18n.readLocaleFromBrowser(), 'zh-CN');
  } finally {
    windowMock.restore();
  }

  windowMock = installWindowMock({ locale: 'en' }, { lang: 'zh-CN' });
  try {
    assert.equal(i18n.readLocaleFromBrowser(), 'en');
  } finally {
    windowMock.restore();
  }

  windowMock = installWindowMock({}, { datasetLocale: 'en', lang: 'zh-CN' });
  try {
    assert.equal(i18n.readLocaleFromBrowser(), 'en');
  } finally {
    windowMock.restore();
  }

  windowMock = installWindowMock({}, { lang: 'en' });
  try {
    assert.equal(i18n.readLocaleFromBrowser(), 'en');
  } finally {
    windowMock.restore();
  }

  windowMock = installWindowMock({}, { lang: 'fr' });
  try {
    assert.equal(i18n.readLocaleFromBrowser(), 'zh-CN');
  } finally {
    windowMock.restore();
  }
});

test('applyLocaleToDocument syncs lang, dataset locale, and title', () => {
  const windowMock = installWindowMock({}, { lang: 'en' });

  try {
    i18n.applyLocaleToDocument('en');
    assert.equal(windowMock.document.documentElement.lang, 'en');
    assert.equal(windowMock.document.documentElement.dataset.locale, 'en');
    assert.equal(windowMock.document.title, i18n.getMessage('en', 'app.title'));
  } finally {
    windowMock.restore();
  }
});
