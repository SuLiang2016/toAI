import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
const text = path => readFileSync(path, 'utf8');
const sanitizeSample = message => message
  .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
  .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
  .replace(/(["']?(?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?)[^"',}\s]+(["']?)/gi, '$1***$2')
  .replace(/[A-Za-z]:\\[^\s"'<>]+/g, '[local path]')
  .replace(/\/(?:Users|home|var|tmp|etc)\/[^\s"'<>]+/g, '[local path]');

const pkg = json('package.json');
assert.equal(pkg.scripts.typecheck, 'tsc --noEmit', 'typecheck script must run tsc --noEmit');
assert.equal(
  pkg.scripts.test,
  'node scripts/run-behavior-tests.mjs && node scripts/verify-upgrade.mjs',
  'test script must run behavior tests before contract verification'
);
assert.match(pkg.scripts['electron-dev'], /pnpm dev/, 'electron-dev must use pnpm dev');
assert.match(pkg.scripts['electron-build'], /pnpm build/, 'electron-build must use pnpm build');
assert.deepEqual(
  Object.keys(pkg.dependencies).sort(),
  ['highlight.js', 'next', 'react', 'react-dom', 'react-markdown', 'remark-gfm'].sort(),
  'upgrade must not add runtime dependencies'
);
assert.deepEqual(
  Object.keys(pkg.devDependencies).sort(),
  [
    '@tailwindcss/postcss',
    '@types/node',
    '@types/react',
    '@types/react-dom',
    'concurrently',
    'cross-env',
    'electron',
    'electron-builder',
    'eslint',
    'eslint-config-next',
    'tailwindcss',
    'typescript',
    'wait-on',
  ].sort(),
  'upgrade must not add development dependencies'
);

assert.ok(existsSync('src/lib/streaming.ts'), 'pure streaming parser module must exist');
assert.ok(existsSync('src/lib/storage.ts'), 'storage schema/migration helper module must exist');
assert.ok(existsSync('src/lib/chat-client.ts'), 'chat client helper module must exist');
assert.ok(existsSync('src/app/api/provider/check/route.ts'), 'provider connectivity check route must exist');
assert.ok(existsSync('scripts/run-behavior-tests.mjs'), 'behavior test runner must exist');
assert.ok(existsSync('scripts/streaming.behavior.test.mjs'), 'streaming behavior tests must exist');
assert.ok(existsSync('scripts/storage.behavior.test.mjs'), 'storage behavior tests must exist');
assert.ok(existsSync('scripts/provider-config.behavior.test.mjs'), 'provider config behavior tests must exist');
assert.ok(existsSync('src/components/chatbox/ChatSidebar.tsx'), 'chat sidebar boundary must exist');
assert.ok(existsSync('src/components/chatbox/ProviderPresetsModal.tsx'), 'provider presets modal boundary must exist');
assert.ok(existsSync('src/components/chatbox/AboutModal.tsx'), 'about modal boundary must exist');
assert.ok(existsSync('src/components/chatbox/TemplateEditorModal.tsx'), 'template editor modal boundary must exist');
assert.ok(existsSync('src/components/chatbox/RenameConversationModal.tsx'), 'rename conversation modal boundary must exist');

const chatTypes = text('src/types/chat.ts');
assert.match(chatTypes, /export type MessageStatus/, 'MessageStatus type must distinguish partial/aborted/error output');
assert.match(chatTypes, /export interface ChatErrorState/, 'ChatErrorState contract must exist');
assert.match(chatTypes, /incomplete_stream/, 'ChatErrorState must include incomplete stream kind');
assert.match(chatTypes, /export interface ProviderCapabilities/, 'ProviderCapabilities type must exist');
assert.match(chatTypes, /export interface ProviderSnapshot/, 'ProviderSnapshot type must exist for per-conversation metadata');
assert.match(chatTypes, /provider\?: ProviderSnapshot/, 'Conversation must carry provider metadata');

const streaming = text('src/lib/streaming.ts');
assert.match(streaming, /export function consumeSseBuffer/, 'streaming module must expose incremental SSE parser');
assert.match(streaming, /\[DONE\]/, 'streaming parser must recognize completion marker');
assert.match(streaming, /StreamingParseError/, 'streaming parser must expose invalid-data error');
assert.match(streaming, /readStreamEventContent/, 'streaming module must expose content extraction');

const storage = text('src/lib/storage.ts');
assert.match(storage, /STORAGE_SCHEMA_VERSION = 2/, 'storage helpers must declare schema version');
assert.match(storage, /CONVERSATIONS_KEY = 'conversations'/, 'storage helpers must own conversations key');
assert.match(storage, /CONVERSATION_DRAFTS_KEY = 'conversationDrafts'/, 'storage helpers must own drafts key');
assert.match(storage, /PROMPT_TEMPLATES_KEY = 'promptTemplates'/, 'storage helpers must own template key');
assert.match(storage, /PROVIDER_PRESETS_KEY = 'providerPresets'/, 'storage helpers must own provider preset key');
assert.match(storage, /loadStoredConversations/, 'storage helpers must load conversations');
assert.match(storage, /normalizeConversation/, 'storage helpers must validate stored conversations');
assert.match(storage, /quarantineCorruptedStorage/, 'storage helpers must quarantine malformed localStorage records');
assert.match(storage, /loadStoredPromptTemplates/, 'storage helpers must validate prompt templates');
assert.match(storage, /loadStoredProviderPresets/, 'storage helpers must validate provider presets');
assert.match(storage, /migrateLegacyProviderSettings/, 'storage helpers must migrate legacy provider settings');
assert.match(storage, /validateProviderSettings/, 'storage helpers must validate provider settings');
assert.match(storage, /createProviderSnapshot/, 'storage helpers must create per-conversation provider snapshots');
assert.match(storage, /pruneConversationDrafts/, 'storage helpers must clean stale drafts');
assert.match(storage, /status: message\.status \?\? 'complete'/, 'storage helpers must preserve explicit message status while defaulting legacy records');

const hook = text('src/hooks/useChat.ts');
assert.match(hook, /consumeSseBuffer/, 'useChat must use pure stream parser');
assert.match(hook, /@\/lib\/chat-client/, 'useChat must delegate client helpers to chat-client');
assert.match(hook, /validateProviderSettings/, 'useChat must validate provider settings before send');
assert.match(hook, /errorState/, 'useChat must expose structured error state');
assert.match(hook, /kind: 'abort'/, 'useChat must distinguish user abort');
assert.match(hook, /incomplete_stream/, 'useChat must distinguish incomplete streams');
assert.match(hook, /upstream_error/, 'useChat must distinguish upstream errors');
assert.match(hook, /validation_error/, 'useChat must distinguish validation errors');
assert.match(hook, /status: 'streaming'/, 'useChat must mark streaming assistant messages');
assert.match(hook, /'partial'/, 'useChat must preserve partial output state');

const chatClient = text('src/lib/chat-client.ts');
assert.match(chatClient, /sanitizeClientError/, 'chat client helpers must sanitize displayed API errors');
assert.match(chatClient, /\[local path\]/, 'chat client helpers must mask local paths in displayed errors');

const providerConfig = text('src/server/ai/config.ts');
assert.match(providerConfig, /validateProviderSettings/, 'provider config must validate settings server-side');
assert.match(providerConfig, /Missing API key/, 'provider config must report missing API key setup');
assert.match(providerConfig, /sanitizeProviderMessage/, 'provider config must sanitize upstream errors');
assert.match(providerConfig, /\[local path\]/, 'provider config must mask local paths');
assert.match(providerConfig, /api\[_-\]\?key\|token\|secret\|password/, 'provider config must mask secret field names');
assert.equal(
  sanitizeSample('{"api_key":"abc","password":"pw"} C:\\Users\\me\\secret.txt Bearer abc.def sk-test'),
  '{"api_key":"***","password":"***"} [local path] Bearer *** sk-***',
  'sanitizer contract must mask JSON-style secrets, local paths, bearer tokens, and sk keys'
);

const provider = text('src/server/ai/openai-compatible.ts');
assert.match(provider, /supportsAttachments/, 'provider must gate attachment forwarding');
assert.match(provider, /message\.attachments/, 'provider must inspect attachment requests');
assert.match(provider, /readUpstreamError/, 'provider must normalize upstream errors');

const checkRoute = text('src/app/api/provider/check/route.ts');
assert.match(checkRoute, /getProviderConfig/, 'provider check route must reuse provider config validation');
assert.match(checkRoute, /\/models/, 'provider check route must use a lightweight provider endpoint');
assert.match(checkRoute, /sanitizeProviderMessage/, 'provider check errors must be sanitized');
assert.match(checkRoute, /AbortController/, 'provider check route must include timeout behavior');

const route = text('src/app/api/chat/route.ts');
assert.match(route, /createOpenAICompatibleStream/, 'API route must delegate provider calls');
assert.doesNotMatch(route, /Unexpected any|:\s*any/, 'API route must avoid any');

const inputArea = text('src/components/InputArea.tsx');
assert.match(inputArea, /value: string/, 'InputArea must accept controlled text value');
assert.match(inputArea, /templates: PromptTemplate\[\]/, 'InputArea must accept prompt templates');
assert.match(inputArea, /supportsAttachments: boolean/, 'InputArea must receive active attachment capability');
assert.match(inputArea, /Image attachments are disabled for the active provider/, 'InputArea must block unsupported image attachments clearly');
assert.match(inputArea, /event\.ctrlKey/, 'InputArea must handle Ctrl+Enter send shortcut');
assert.match(inputArea, /event\.metaKey/, 'InputArea must handle Meta+Enter send shortcut');
assert.match(inputArea, /event\.nativeEvent\.isComposing/, 'InputArea must not submit while IME composition is active');
assert.match(inputArea, /event\.key === 'Escape' && isLoading/, 'InputArea must handle Escape while loading');
assert.match(inputArea, /URL\.revokeObjectURL/, 'InputArea must release image preview object URLs');
assert.match(inputArea, /slashRange/, 'InputArea must track slash command ranges');
assert.match(inputArea, /ArrowDown/, 'InputArea must support template picker keyboard navigation');

const chatBox = text('src/components/ChatBox.tsx');
assert.match(chatBox, /ChatSidebar/, 'ChatBox must compose an extracted sidebar surface');
assert.match(chatBox, /ProviderPresetsModal/, 'ChatBox must compose an extracted provider modal surface');
assert.match(chatBox, /AboutModal/, 'ChatBox must compose an extracted about modal surface');
assert.match(chatBox, /TemplateEditorModal/, 'ChatBox must compose an extracted template modal surface');
assert.match(chatBox, /RenameConversationModal/, 'ChatBox must compose an extracted rename modal surface');
assert.match(chatBox, /loadStoredConversations/, 'ChatBox must load conversations through storage helpers');
assert.match(chatBox, /filteredConversations/, 'ChatBox must support conversation search/filter');
assert.match(chatBox, /renameConversationId/, 'ChatBox must support explicit conversation rename');
assert.match(chatBox, /pruneConversationDrafts/, 'ChatBox must expose stale draft cleanup');
assert.match(chatBox, /handleConversationKeyDown/, 'ChatBox must support keyboard navigation in conversation list');
assert.match(chatBox, /Provider: \{currentProviderLabel\}/, 'ChatBox must show active provider without secrets');
assert.match(chatBox, /\/api\/provider\/check/, 'ChatBox must call provider connectivity check');
assert.match(chatBox, /createProviderSnapshot/, 'ChatBox must write provider metadata snapshots');
assert.match(chatBox, /getAppInfo/, 'ChatBox must render app-info/about data');
assert.match(chatBox, /exportLogs/, 'ChatBox must expose sanitized log export');
assert.doesNotMatch(chatBox, /apiKey|API Key.*input|key.*localStorage/i, 'Provider preset UI must not store or render API keys');
assert.match(chatBox, /navigator\.clipboard\.writeText/, 'ChatBox must copy message/code text to clipboard');
assert.match(chatBox, /removeLatestAssistantMessage\(\)/, 'Regenerate must remove only the latest assistant response');
assert.match(chatBox, /restoreMessages\(previousMessages\)/, 'Regenerate must restore history when resend fails');

const messageList = text('src/components/MessageList.tsx');
assert.match(messageList, /latestAssistantId/, 'MessageList must identify the latest assistant message');
assert.match(messageList, /canRegenerate=\{message\.id === latestAssistantId && !isLoading\}/, 'MessageList must restrict regenerate to latest assistant message');

const messageBubble = text('src/components/MessageBubble.tsx');
assert.match(messageBubble, /message\.status/, 'MessageBubble must surface partial/aborted/error message state');
assert.match(messageBubble, /onCopyCode\(code\)/, 'MessageBubble must expose code-block copy action');
assert.match(messageBubble, /onEditResend\(message\)/, 'MessageBubble must expose edit-resend action');

const electronMain = text('electron/main.js');
assert.match(electronMain, /nodeIntegration:\s*false/, 'Electron must keep nodeIntegration disabled');
assert.match(electronMain, /contextIsolation:\s*true/, 'Electron must keep contextIsolation enabled');
assert.match(electronMain, /preload\.js/, 'Electron must load a preload bridge');
assert.match(electronMain, /diagnostics:get/, 'Electron must expose diagnostics IPC');
assert.match(electronMain, /logs:export/, 'Electron must expose sanitized log export IPC');
assert.match(electronMain, /logs:open/, 'Electron must expose sanitized log open IPC');
assert.match(electronMain, /sanitizeLogText/, 'Electron logs must be sanitized');
assert.match(electronMain, /startProductionNextServer/, 'Electron production must load the built Next app');
assert.match(electronMain, /lastStartupDiagnostic/, 'Electron must record embedded startup diagnostics');
assert.match(electronMain, /isLegacyDefaultSettings/, 'Electron settings must ignore legacy default provider config');

const preload = text('electron/preload.js');
assert.match(preload, /getDiagnostics/, 'preload bridge must expose diagnostics');
assert.match(preload, /exportLogs/, 'preload bridge must expose log export');
assert.match(preload, /openLogs/, 'preload bridge must expose log open');

const roadmap = text('docs/NEXT_UPGRADE_ROADMAP.md');
assert.match(roadmap, /Execution Evidence/, 'roadmap must record execution evidence');
assert.match(roadmap, /Phase 1/, 'roadmap must keep phase references');
assert.match(roadmap, /pnpm lint/, 'roadmap must record verification commands');

const optimizationDirections = text('docs/NEXT_OPTIMIZATION_DIRECTIONS.md');
assert.match(optimizationDirections, /Maintainability/, 'optimization directions must track the maintainability direction');
assert.match(optimizationDirections, /behavior-level/, 'optimization directions must mention behavior-level verification');

console.log('upgrade verification checks passed');
