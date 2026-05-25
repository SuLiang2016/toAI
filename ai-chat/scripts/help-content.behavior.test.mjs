import assert from 'node:assert/strict';
import test from 'node:test';
import { importBehaviorModule } from './behavior-test-helpers.mjs';

const helpModule = await importBehaviorModule('in-app-help.mjs');

test('in-app help content stays in parity across zh-CN and en locales', () => {
  const zhHelp = helpModule.getInAppHelp('zh-CN');
  const enHelp = helpModule.getInAppHelp('en');

  assert.equal(zhHelp.title, 'AI Chat 使用说明');
  assert.equal(enHelp.title, 'AI Chat Help');
  assert.equal(zhHelp.sections.length, 3);
  assert.equal(enHelp.sections.length, 3);
  assert.deepEqual(
    zhHelp.sections.map(section => section.id),
    ['model-switching', 'prompt-templates', 'conversation-switching']
  );
  assert.deepEqual(
    zhHelp.sections.map(section => section.id),
    enHelp.sections.map(section => section.id)
  );

  for (const [locale, content] of [['zh-CN', zhHelp], ['en', enHelp]]) {
    assert.ok(content.intro.trim().length > 0, `${locale} help must have intro text`);
    for (const section of content.sections) {
      assert.ok(section.title.trim().length > 0, `${locale} section ${section.id} must have a title`);
      assert.ok(section.body.trim().length > 0, `${locale} section ${section.id} must have body content`);
    }
  }

  assert.match(zhHelp.markdown, /## 模型配置与切换/);
  assert.match(zhHelp.markdown, /## 提示词模板的创建与使用/);
  assert.match(zhHelp.markdown, /## 创建与切换会话/);
  assert.match(enHelp.markdown, /## Configure and switch models/);
  assert.match(enHelp.markdown, /## Create and use prompt templates/);
  assert.match(enHelp.markdown, /## Create and switch conversations/);
});
