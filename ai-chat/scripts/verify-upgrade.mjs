import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

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
assert.equal(pkg.scripts.test, 'node scripts/verify-upgrade.mjs', 'test script must be explicit and non-placeholder');
assert.match(pkg.scripts['electron-dev'], /pnpm dev/, 'electron-dev must use pnpm dev');
assert.match(pkg.scripts['electron-build'], /pnpm build/, 'electron-build must use pnpm build');
assert.deepEqual(
  Object.keys(pkg.dependencies).sort(),
  ['highlight.js', 'next', 'react', 'react-dom', 'react-markdown', 'remark-gfm'].sort(),
  'Phase 1 must not add runtime dependencies'
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
  'Phase 1 must not add development dependencies'
);

const route = text('src/app/api/chat/route.ts');
assert.match(route, /createOpenAICompatibleStream/, 'API route must delegate provider calls');
assert.doesNotMatch(route, /Unexpected any|:\s*any/, 'API route must avoid any');

const providerConfig = text('src/server/ai/config.ts');
assert.match(providerConfig, /AI_API_KEY/, 'provider config must report missing API key setup');
assert.match(providerConfig, /sanitizeProviderMessage/, 'provider config must sanitize upstream errors');
assert.match(providerConfig, /\[local path\]/, 'provider config must mask local paths in upstream errors');
assert.match(providerConfig, /api\[_-\]\?key\|token\|secret\|password/, 'provider config must mask quoted and unquoted secret field names');
assert.equal(
  sanitizeSample('{"api_key":"abc","password":"pw"} C:\\Users\\me\\secret.txt Bearer abc.def sk-test'),
  '{"api_key":"***","password":"***"} [local path] Bearer *** sk-***',
  'sanitizer contract must mask JSON-style secrets, local paths, bearer tokens, and sk keys'
);

const provider = text('src/server/ai/openai-compatible.ts');
assert.match(provider, /supportsAttachments/, 'provider must declare attachment support gate');
assert.match(provider, /message\.attachments/, 'provider must inspect attachment requests');
assert.match(provider, /readUpstreamError/, 'provider must normalize upstream errors');

const hook = text('src/hooks/useChat.ts');
assert.match(hook, /AbortError/, 'useChat must handle user aborts');
assert.match(hook, /consumeSseBuffer/, 'useChat must parse streaming SSE incrementally');
assert.match(hook, /readErrorResponse/, 'useChat must show API error messages');
assert.match(hook, /sawDone/, 'useChat must detect interrupted response streams');
assert.match(hook, /Promise<boolean>/, 'useChat sendMessage must report accepted handoff status');
assert.match(hook, /return true/, 'useChat must return true after accepted send completion');
assert.match(hook, /return false/, 'useChat must return false when send setup or delivery fails');
assert.match(hook, /resendFromMessages/, 'useChat must expose regenerate resend path');
assert.match(hook, /removeLatestAssistantMessage/, 'useChat must expose latest assistant removal for regeneration');
assert.match(hook, /submitChatTurn/, 'useChat must share streaming logic between send and regenerate');
assert.match(hook, /skipUserMessageCreation/, 'useChat regenerate must avoid creating a duplicate user message');
assert.match(hook, /restoreMessages/, 'useChat must support restoring history when regenerate fails');
assert.match(hook, /sanitizeClientError/, 'useChat must sanitize displayed API errors');
assert.match(hook, /\[local path\]/, 'useChat must mask local paths in displayed errors');

const chatTypes = text('src/types/chat.ts');
assert.match(chatTypes, /export interface PromptTemplate/, 'PromptTemplate type must exist');
assert.match(chatTypes, /id: string[\s\S]*title: string[\s\S]*content: string[\s\S]*createdAt: number[\s\S]*updatedAt: number/, 'PromptTemplate must include required fields');
assert.match(chatTypes, /export interface ProviderPreset extends ProviderSettings/, 'ProviderPreset type must extend provider settings');
assert.match(chatTypes, /name: string[\s\S]*createdAt: number[\s\S]*updatedAt: number/, 'ProviderPreset must include name and timestamps');

const inputArea = text('src/components/InputArea.tsx');
assert.match(inputArea, /interface InputAreaProps[\s\S]*value: string/, 'InputArea must accept controlled text value');
assert.match(inputArea, /interface InputAreaProps[\s\S]*onChange: \(value: string\) => void/, 'InputArea must accept controlled text changes');
assert.match(inputArea, /templates: PromptTemplate\[\]/, 'InputArea must accept prompt templates');
assert.match(inputArea, /supportsAttachments: boolean/, 'InputArea must receive active attachment capability');
assert.doesNotMatch(inputArea, /disabled=\{!supportsAttachments\}/, 'InputArea must keep text-file import reachable when image attachments are unsupported');
assert.match(inputArea, /Images disabled; \.txt import available/, 'InputArea must show image capability without blocking text import');
assert.match(inputArea, /MAX_IMAGE_ATTACHMENT_SIZE/, 'InputArea must define an image attachment size limit');
assert.match(inputArea, /MAX_TEXT_FILE_SIZE/, 'InputArea must define a text file size limit');
assert.match(inputArea, /isPlainTextFile/, 'InputArea must detect plain text files locally');
assert.match(inputArea, /readTextFile/, 'InputArea must read text files in-browser');
assert.match(inputArea, /appendTextSnippets/, 'InputArea must insert text file content into the draft');
assert.match(inputArea, /Unsupported file type/, 'InputArea must reject unsupported binary files locally');
assert.match(inputArea, /Image attachments are disabled for the active provider/, 'InputArea must block unsupported image attachments clearly');
assert.match(inputArea, /formatBytes/, 'InputArea must report size limits without local paths');
assert.match(inputArea, /onSend: \(content: string, files\?: File\[\]\) => SendResult/, 'InputArea must accept an awaitable send result');
assert.doesNotMatch(inputArea, /const \[input,\s*setInput\]/, 'InputArea must not own all text internally');
assert.match(inputArea, /value=\{value\}/, 'InputArea textarea must render controlled value');
assert.match(inputArea, /onChange=\{handleDraftChange\}/, 'InputArea textarea must forward changes');
assert.match(inputArea, /setSelectedFiles\(\[\]\)/, 'InputArea must still clear selected files after send');
assert.match(inputArea, /const accepted = await onSend/, 'InputArea must clear attachments only after send is accepted');
assert.match(inputArea, /event\.ctrlKey/, 'InputArea must handle Ctrl+Enter send shortcut');
assert.match(inputArea, /event\.metaKey/, 'InputArea must handle Meta+Enter send shortcut');
assert.match(inputArea, /event\.nativeEvent\.isComposing/, 'InputArea must not submit while IME composition is active');
assert.match(inputArea, /event\.key === 'Escape' && isLoading/, 'InputArea must handle Escape only while loading');
assert.match(inputArea, /onStop\?\.\(\)/, 'InputArea Escape handling must call onStop');
assert.match(inputArea, /URL\.revokeObjectURL/, 'InputArea must release image preview object URLs');
assert.doesNotMatch(inputArea, /src=\{URL\.createObjectURL/, 'InputArea must not create object URLs during render');
assert.match(inputArea, /slashRange/, 'InputArea must track slash command ranges');
assert.match(inputArea, /slashQuery/, 'InputArea must filter templates from slash query text');
assert.match(inputArea, /filteredTemplates/, 'InputArea must render filtered template matches');
assert.match(inputArea, /lastIndexOf\('\/'\)/, 'InputArea must detect slash commands before the cursor');
assert.match(inputArea, /event\.key === 'ArrowDown'/, 'InputArea must support template picker ArrowDown navigation');
assert.match(inputArea, /event\.key === 'ArrowUp'/, 'InputArea must support template picker ArrowUp navigation');
assert.match(inputArea, /insertTemplate\(template\)/, 'InputArea must insert highlighted or clicked templates');
assert.match(inputArea, /setSelectionRange\(nextCursor, nextCursor\)/, 'InputArea must restore cursor after template insertion');

const chatBox = text('src/components/ChatBox.tsx');
assert.match(chatBox, /handleDeleteConversation/, 'ChatBox must support conversation deletion');
assert.match(chatBox, /loadMessages\(conversation\.messages\)/, 'ChatBox must restore history messages');
assert.match(chatBox, /readStoredProviderSettings/, 'ChatBox must read only stored provider overrides');
assert.match(chatBox, /return emptyToUndefined\(normalizeProviderSettings\(stored\)\)/, 'ChatBox must not send default settings over env config');
assert.match(chatBox, /isLegacyDefaultProviderSettings/, 'ChatBox must ignore legacy default settings that masked env config');
assert.match(chatBox, /PROVIDER_PRESETS_KEY = 'providerPresets'/, 'ChatBox must store provider presets separately');
assert.match(chatBox, /ACTIVE_PROVIDER_PRESET_KEY = 'activeProviderPresetId'/, 'ChatBox must store the active provider preset id separately');
assert.match(chatBox, /loadStoredProviderPresets/, 'ChatBox must load provider presets from localStorage');
assert.match(chatBox, /saveProviderPresets/, 'ChatBox must save provider presets to localStorage');
assert.match(chatBox, /readActiveProviderSettings/, 'ChatBox requests must use the active provider preset');
assert.match(chatBox, /openNewProviderPreset/, 'ChatBox must support creating provider presets');
assert.match(chatBox, /openEditProviderPreset/, 'ChatBox must support editing provider presets');
assert.match(chatBox, /activateProviderPreset/, 'ChatBox must support activating provider presets');
assert.match(chatBox, /deleteProviderPreset/, 'ChatBox must support deleting provider presets');
assert.match(chatBox, /migrateLegacyProviderSettings/, 'ChatBox must migrate the legacy single provider settings key');
assert.match(chatBox, /if \(saved\) \{[\s\S]*return migrateLegacyProviderSettings\(\)/, 'Provider presets must migrate legacy settings when the preset key is missing');
assert.match(chatBox, /window\.localStorage\.removeItem\(PROVIDER_SETTINGS_KEY\)/, 'Provider preset migration must remove the legacy single settings key');
assert.match(chatBox, /supportsAttachments=\{activeProviderPreset\?\.supportsAttachments \?\? true\}/, 'ChatBox must not block environment-default attachment support when no preset is active');
assert.match(chatBox, /controlled by environment defaults/, 'Provider settings UI must distinguish environment-default attachment capability');
assert.doesNotMatch(chatBox, /apiKey|API Key.*input|key.*localStorage/i, 'Provider preset UI must not store or render API keys');
assert.match(chatBox, /CONVERSATION_DRAFTS_KEY = 'conversationDrafts'/, 'ChatBox must define a separate conversation drafts storage key');
assert.match(chatBox, /NEW_CONVERSATION_DRAFT_KEY = 'newConversationDraft'/, 'ChatBox must define a separate new-chat draft bucket');
assert.match(chatBox, /loadDraftForConversation/, 'ChatBox must load drafts by conversation id');
assert.match(chatBox, /saveDraftForConversation\(currentConvIdRef\.current, nextDraft\)/, 'ChatBox must persist draft edits for the active conversation');
assert.match(chatBox, /persistCurrentDraft\(\)/, 'ChatBox must save outgoing drafts before navigation');
assert.match(chatBox, /const accepted = await sendMessage\(content, files\)/, 'ChatBox must await the send handoff before clearing drafts');
assert.match(chatBox, /if \(accepted\) \{[\s\S]*clearDraftForConversation\(draftConversationId\)/, 'ChatBox must clear drafts only after accepted send handoff');
assert.match(chatBox, /clearDraftForConversation\(draftConversationId\)/, 'ChatBox must clear only the active draft after send handoff');
assert.match(chatBox, /deleteDraftForConversation\(conversationId\)/, 'ChatBox must remove drafts when deleting conversations');
assert.match(chatBox, /<InputArea[\s\S]*value=\{draftText\}[\s\S]*onChange=\{handleDraftChange\}/, 'ChatBox must pass controlled draft state to InputArea');
assert.match(chatBox, /PROMPT_TEMPLATES_KEY = 'promptTemplates'/, 'ChatBox must define prompt template storage');
assert.match(chatBox, /loadStoredPromptTemplates/, 'ChatBox must load prompt templates from localStorage');
assert.match(chatBox, /savePromptTemplates/, 'ChatBox must save prompt templates to localStorage');
assert.match(chatBox, /openNewTemplate/, 'ChatBox must support template creation');
assert.match(chatBox, /openEditTemplate/, 'ChatBox must support template editing');
assert.match(chatBox, /deleteTemplate/, 'ChatBox must support template deletion');
assert.match(chatBox, /insertTemplateIntoDraft/, 'ChatBox must support inserting templates into the current draft');
assert.match(chatBox, /templates=\{promptTemplates\}/, 'ChatBox must pass templates to InputArea slash picker');
assert.match(chatBox, /navigator\.clipboard\.writeText/, 'ChatBox must copy message/code text to clipboard');
assert.match(chatBox, /handleCopyMessage/, 'ChatBox must support full-message copy');
assert.match(chatBox, /handleCopyCode/, 'ChatBox must support code-block copy');
assert.match(chatBox, /handleRegenerate/, 'ChatBox must support regenerating the latest assistant response');
assert.match(chatBox, /const previousMessages = messages/, 'Regenerate must preserve the pre-removal history snapshot');
assert.match(chatBox, /removeLatestAssistantMessage\(\)/, 'Regenerate must remove only the latest assistant response');
assert.match(chatBox, /resendFromMessages\(nextMessages\)/, 'Regenerate must resend from preserved history');
assert.match(chatBox, /restoreMessages\(previousMessages\)/, 'Regenerate must restore the original assistant when resend fails');
assert.match(chatBox, /handleEditResend/, 'ChatBox must support edit-resend for user messages');
assert.match(chatBox, /handleDraftChange\(message\.content\)/, 'Edit-resend must load user message content into draft');

const messageList = text('src/components/MessageList.tsx');
assert.match(messageList, /latestAssistantId/, 'MessageList must identify the latest assistant message');
assert.match(messageList, /canRegenerate=\{message\.id === latestAssistantId && !isLoading\}/, 'MessageList must restrict regenerate to latest assistant message');
assert.match(messageList, /onCopyMessage/, 'MessageList must pass message copy action');
assert.match(messageList, /onCopyCode/, 'MessageList must pass code copy action');
assert.match(messageList, /onEditResend/, 'MessageList must pass edit-resend action');

const messageBubble = text('src/components/MessageBubble.tsx');
assert.match(messageBubble, /onCopyMessage\(message\)/, 'MessageBubble must expose message copy action');
assert.match(messageBubble, /onCopyCode\(code\)/, 'MessageBubble must expose code-block copy action');
assert.match(messageBubble, /onRegenerate/, 'MessageBubble must expose regenerate action');
assert.match(messageBubble, /onEditResend\(message\)/, 'MessageBubble must expose edit-resend action');
assert.match(messageBubble, /extractText/, 'MessageBubble must extract raw code text from rendered code blocks');

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
