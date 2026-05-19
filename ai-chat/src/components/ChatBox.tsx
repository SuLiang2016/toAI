'use client';

/* eslint-disable react-hooks/set-state-in-effect -- localStorage must hydrate after the first client mount. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { useChat } from '@/hooks/useChat';
import { Conversation, Message, ProviderSettings } from '@/types/chat';

const CONVERSATIONS_KEY = 'conversations';
const ACTIVE_CONVERSATION_KEY = 'currentConversationId';
const PROVIDER_SETTINGS_KEY = 'providerSettings';
const PROVIDER_SETTINGS_VERSION = 1;
const LEGACY_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const LEGACY_DEFAULT_MODEL = 'gpt-3.5-turbo';

const SETTINGS_FORM_DEFAULTS: ProviderSettings = {
  baseUrl: '',
  model: '',
  supportsAttachments: false,
};

type StoredProviderSettings = ProviderSettings & {
  version?: number;
};

export default function ChatBox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<ProviderSettings>(SETTINGS_FORM_DEFAULTS);
  const currentConvIdRef = useRef<string | null>(currentConvId);

  const currentConversation = conversations.find(conv => conv.id === currentConvId);

  const persistMessages = useCallback((nextMessages: Message[]) => {
    const conversationId = currentConvIdRef.current;
    if (!conversationId) return;

    setConversations(previous => {
      const existing = previous.find(conv => conv.id === conversationId);
      const nextConversation: Conversation = {
        id: conversationId,
        title: existing?.title || createConversationTitle(nextMessages),
        messages: nextMessages,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      const nextConversations = [
        nextConversation,
        ...previous.filter(conv => conv.id !== conversationId),
      ];
      saveConversations(nextConversations);
      return nextConversations;
    });
  }, []);

  const getSettings = useCallback(async () => readStoredProviderSettings(), []);

  const { messages, isLoading, error, sendMessage, stopGeneration, clearMessages, loadMessages } = useChat({
    initialMessages: currentConversation?.messages ?? [],
    onMessagesChange: persistMessages,
    getSettings,
  });

  useEffect(() => {
    const storedConversations = loadStoredConversations();
    const activeId = loadInitialConversationId(storedConversations);
    const activeConversation = storedConversations.find(conv => conv.id === activeId);

    currentConvIdRef.current = activeId;
    setConversations(storedConversations);
    setCurrentConvId(activeId);
    loadMessages(activeConversation?.messages ?? []);
  }, [loadMessages]);

  const handleNewChat = () => {
    currentConvIdRef.current = null;
    clearMessages();
    setCurrentConvId(null);
    saveActiveConversationId(null);
  };

  const handleSelectConversation = (conv: Conversation) => {
    currentConvIdRef.current = conv.id;
    setCurrentConvId(conv.id);
    saveActiveConversationId(conv.id);
    loadMessages(conv.messages);
  };

  const handleSend = (content: string, files?: File[]) => {
    if (!currentConvIdRef.current) {
      const nextId = createId();
      currentConvIdRef.current = nextId;
      setCurrentConvId(nextId);
      saveActiveConversationId(nextId);
    }

    sendMessage(content, files);
  };

  const handleDeleteConversation = (conversationId: string) => {
    const nextConversations = conversations.filter(conv => conv.id !== conversationId);
    const nextActive = currentConvIdRef.current === conversationId ? nextConversations[0] ?? null : null;
    setConversations(nextConversations);
    saveConversations(nextConversations);

    if (currentConvIdRef.current === conversationId) {
      currentConvIdRef.current = nextActive?.id ?? null;
      setCurrentConvId(nextActive?.id ?? null);
      saveActiveConversationId(nextActive?.id ?? null);
      loadMessages(nextActive?.messages ?? []);
    }
  };

  const openSettings = async () => {
    setSettingsDraft({
      ...SETTINGS_FORM_DEFAULTS,
      ...(await readStoredProviderSettings()),
    });
    setShowSettings(true);
  };

  const saveSettings = async () => {
    await writeProviderSettings(normalizeProviderSettings(settingsDraft));
    setShowSettings(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 - 对话历史 */}
      {showSidebar && (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={handleNewChat}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              + 新对话
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex w-full items-center gap-2 border-b border-gray-100 px-3 py-3 hover:bg-gray-100 ${
                  currentConvId === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <button
                  onClick={() => handleSelectConversation(conv)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-sm font-medium text-gray-900">{conv.title}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteConversation(conv.id)}
                  className="rounded p-1 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  title="删除对话"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M10 11v6m4-6v6m1-10V5a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m-2 0l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={showSidebar ? '隐藏侧边栏' : '显示侧边栏'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <h1 className="text-lg font-semibold text-gray-900">
            {currentConvId ? conversations.find(c => c.id === currentConvId)?.title || '对话' : '新对话'}
          </h1>
          
          <div className="flex items-center gap-1">
            <button
              onClick={openSettings}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="设置"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.89 3.31.877 2.42 2.42a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.89 1.543-.877 3.31-2.42 2.42a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.89-3.31-.877-2.42-2.42a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.89-1.543.877-3.31 2.42-2.42.996.574 2.25.055 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={clearMessages}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="清空对话"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 输入区域 */}
        <InputArea onSend={handleSend} onStop={stopGeneration} isLoading={isLoading} />
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">模型设置</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                title="关闭"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">API Base URL</span>
              <input
                value={settingsDraft.baseUrl ?? ''}
                onChange={event => setSettingsDraft(previous => ({ ...previous, baseUrl: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">模型名称</span>
              <input
                value={settingsDraft.model ?? ''}
                onChange={event => setSettingsDraft(previous => ({ ...previous, model: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settingsDraft.supportsAttachments ?? false}
                onChange={event => setSettingsDraft(previous => ({ ...previous, supportsAttachments: event.target.checked }))}
              />
              启用图片附件直传协议
            </label>

            <p className="mb-4 text-xs text-gray-500">
              API Key 仍由 `.env.local` 提供，不在界面中展示或保存。
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                onClick={saveSettings}
                className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function loadStoredConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(CONVERSATIONS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load conversations:', error);
    return [];
  }
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

function loadStoredActiveConversationId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  } catch {
    return null;
  }
}

function loadInitialConversationId(conversations = loadStoredConversations()): string | null {
  const activeId = loadStoredActiveConversationId();
  return conversations.some(conv => conv.id === activeId) ? activeId : conversations[0]?.id ?? null;
}

function saveActiveConversationId(conversationId: string | null) {
  if (typeof window === 'undefined') return;

  if (conversationId) {
    window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId);
  } else {
    window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }
}

function createConversationTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(message => message.role === 'user' && message.content.trim());
  const title = firstUserMessage?.content.trim() || '新对话';
  return title.length > 30 ? `${title.slice(0, 30)}...` : title;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readStoredProviderSettings(): Promise<ProviderSettings | undefined> {
  if (typeof window === 'undefined') return undefined;

  if (window.aiChat?.getSettings) {
    return emptyToUndefined(normalizeProviderSettings(await window.aiChat.getSettings()));
  }

  try {
    const saved = window.localStorage.getItem(PROVIDER_SETTINGS_KEY);
    if (!saved) return undefined;

    const stored = JSON.parse(saved) as StoredProviderSettings;
    if (isLegacyDefaultProviderSettings(stored)) {
      return undefined;
    }

    return emptyToUndefined(normalizeProviderSettings(stored));
  } catch {
    return undefined;
  }
}

async function writeProviderSettings(settings: ProviderSettings) {
  if (typeof window === 'undefined') return;

  if (window.aiChat?.saveSettings) {
    await window.aiChat.saveSettings(settings);
    return;
  }

  window.localStorage.setItem(
    PROVIDER_SETTINGS_KEY,
    JSON.stringify({ ...settings, version: PROVIDER_SETTINGS_VERSION })
  );
}

function normalizeProviderSettings(settings?: ProviderSettings): ProviderSettings {
  const baseUrl = settings?.baseUrl?.trim();
  const model = settings?.model?.trim();

  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(model ? { model } : {}),
    ...(typeof settings?.supportsAttachments === 'boolean'
      ? { supportsAttachments: settings.supportsAttachments }
      : {}),
  };
}

function emptyToUndefined(settings: ProviderSettings): ProviderSettings | undefined {
  const hasBaseUrl = Boolean(settings.baseUrl);
  const hasModel = Boolean(settings.model);
  const hasAttachmentOverride = typeof settings.supportsAttachments === 'boolean';
  return hasBaseUrl || hasModel || hasAttachmentOverride ? settings : undefined;
}

function isLegacyDefaultProviderSettings(settings: StoredProviderSettings): boolean {
  return (
    settings.version === undefined &&
    settings.baseUrl === LEGACY_DEFAULT_BASE_URL &&
    settings.model === LEGACY_DEFAULT_MODEL &&
    settings.supportsAttachments === false
  );
}
