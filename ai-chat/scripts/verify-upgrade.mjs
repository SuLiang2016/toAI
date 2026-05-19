import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const text = path => readFileSync(path, 'utf8');

const pkg = json('package.json');
assert.equal(pkg.scripts.typecheck, 'tsc --noEmit', 'typecheck script must run tsc --noEmit');
assert.equal(pkg.scripts.test, 'node scripts/verify-upgrade.mjs', 'test script must be explicit and non-placeholder');
assert.match(pkg.scripts['electron-dev'], /pnpm dev/, 'electron-dev must use pnpm dev');
assert.match(pkg.scripts['electron-build'], /pnpm build/, 'electron-build must use pnpm build');

const route = text('src/app/api/chat/route.ts');
assert.match(route, /createOpenAICompatibleStream/, 'API route must delegate provider calls');
assert.doesNotMatch(route, /Unexpected any|:\s*any/, 'API route must avoid any');

const providerConfig = text('src/server/ai/config.ts');
assert.match(providerConfig, /未配置 API Key/, 'provider config must report missing API key');
assert.match(providerConfig, /sanitizeProviderMessage/, 'provider config must sanitize upstream errors');

const provider = text('src/server/ai/openai-compatible.ts');
assert.match(provider, /supportsAttachments/, 'provider must declare attachment support gate');
assert.match(provider, /当前模型未启用附件转发/, 'provider must reject unsupported attachment requests clearly');
assert.match(provider, /readUpstreamError/, 'provider must normalize upstream errors');

const hook = text('src/hooks/useChat.ts');
assert.match(hook, /AbortError/, 'useChat must handle user aborts');
assert.match(hook, /consumeSseBuffer/, 'useChat must parse streaming SSE incrementally');
assert.match(hook, /readErrorResponse/, 'useChat must show API error messages');
assert.match(hook, /无法解析的流式数据/, 'useChat must report bad stream JSON');
assert.match(hook, /响应流提前中断/, 'useChat must report interrupted streams');

const chatBox = text('src/components/ChatBox.tsx');
assert.match(chatBox, /handleDeleteConversation/, 'ChatBox must support conversation deletion');
assert.match(chatBox, /loadMessages\(conv.messages\)/, 'ChatBox must restore history messages');
assert.match(chatBox, /模型设置/, 'ChatBox must expose model settings UI');
assert.match(chatBox, /readStoredProviderSettings/, 'ChatBox must read only stored provider overrides');
assert.match(chatBox, /return emptyToUndefined\(normalizeProviderSettings\(stored\)\)/, 'ChatBox must not send default settings over env config');
assert.match(chatBox, /isLegacyDefaultProviderSettings/, 'ChatBox must ignore legacy default settings that masked env config');

const electronMain = text('electron/main.js');
assert.match(electronMain, /nodeIntegration:\s*false/, 'Electron must keep nodeIntegration disabled');
assert.match(electronMain, /contextIsolation:\s*true/, 'Electron must keep contextIsolation enabled');
assert.match(electronMain, /preload\.js/, 'Electron must load a preload bridge');
assert.match(electronMain, /startProductionNextServer/, 'Electron production must load the built Next app');
assert.doesNotMatch(electronMain, /baseUrl: typeof settings\?\.baseUrl === 'string' \? settings\.baseUrl : 'https:\/\/api\.openai\.com\/v1'/, 'Electron settings must not default over env provider config');
assert.match(electronMain, /isLegacyDefaultSettings/, 'Electron settings must ignore legacy default provider config');

assert.ok(existsSync('electron/preload.js'), 'preload bridge must exist');
assert.ok(existsSync('src/server/ai/openai-compatible.ts'), 'provider boundary must exist');
assert.ok(existsSync('src/server/ai/config.ts'), 'provider config reader must exist');

console.log('upgrade verification checks passed');
