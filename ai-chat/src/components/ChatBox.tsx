'use client';

/* eslint-disable react-hooks/set-state-in-effect -- localStorage must hydrate after the first client mount. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { useChat } from '@/hooks/useChat';
import { Conversation, Message, PromptTemplate, ProviderPreset, ProviderSettings } from '@/types/chat';

const CONVERSATIONS_KEY = 'conversations';
const ACTIVE_CONVERSATION_KEY = 'currentConversationId';
const CONVERSATION_DRAFTS_KEY = 'conversationDrafts';
const NEW_CONVERSATION_DRAFT_KEY = 'newConversationDraft';
const PROMPT_TEMPLATES_KEY = 'promptTemplates';
const PROVIDER_PRESETS_KEY = 'providerPresets';
const ACTIVE_PROVIDER_PRESET_KEY = 'activeProviderPresetId';
const PROVIDER_SETTINGS_KEY = 'providerSettings';
const LEGACY_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const LEGACY_DEFAULT_MODEL = 'gpt-3.5-turbo';

type StoredProviderSettings = ProviderSettings & {
  version?: number;
};

interface TemplateFormDraft {
  id: string | null;
  title: string;
  content: string;
}

interface ProviderPresetFormDraft {
  id: string | null;
  name: string;
  baseUrl: string;
  model: string;
  supportsAttachments: boolean;
}

const EMPTY_TEMPLATE_FORM: TemplateFormDraft = {
  id: null,
  title: '',
  content: '',
};

const EMPTY_PROVIDER_PRESET_FORM: ProviderPresetFormDraft = {
  id: null,
  name: '',
  baseUrl: '',
  model: '',
  supportsAttachments: false,
};

export default function ChatBox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateFormDraft>(EMPTY_TEMPLATE_FORM);
  const [providerPresets, setProviderPresets] = useState<ProviderPreset[]>([]);
  const [activeProviderPresetId, setActiveProviderPresetId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<ProviderPresetFormDraft>(EMPTY_PROVIDER_PRESET_FORM);
  const currentConvIdRef = useRef<string | null>(currentConvId);
  const draftTextRef = useRef('');

  const currentConversation = conversations.find(conversation => conversation.id === currentConvId);

  const loadDraftIntoState = useCallback((conversationId: string | null) => {
    const nextDraft = loadDraftForConversation(conversationId);
    draftTextRef.current = nextDraft;
    setDraftText(nextDraft);
  }, []);

  const persistCurrentDraft = useCallback(() => {
    saveDraftForConversation(currentConvIdRef.current, draftTextRef.current);
  }, []);

  const handleDraftChange = useCallback((nextDraft: string) => {
    draftTextRef.current = nextDraft;
    setDraftText(nextDraft);
    saveDraftForConversation(currentConvIdRef.current, nextDraft);
  }, []);

  const persistMessages = useCallback((nextMessages: Message[]) => {
    const conversationId = currentConvIdRef.current;
    if (!conversationId) return;

    setConversations(previous => {
      const existing = previous.find(conversation => conversation.id === conversationId);
      const nextConversation: Conversation = {
        id: conversationId,
        title: existing?.title || createConversationTitle(nextMessages),
        messages: nextMessages,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      const nextConversations = [
        nextConversation,
        ...previous.filter(conversation => conversation.id !== conversationId),
      ];
      saveConversations(nextConversations);
      return nextConversations;
    });
  }, []);

  const getSettings = useCallback(async () => readActiveProviderSettings(), []);

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    resendFromMessages,
    stopGeneration,
    clearMessages,
    restoreMessages,
    loadMessages,
    removeLatestAssistantMessage,
  } = useChat({
    initialMessages: currentConversation?.messages ?? [],
    onMessagesChange: persistMessages,
    getSettings,
  });

  useEffect(() => {
    const storedConversations = loadStoredConversations();
    const activeId = loadInitialConversationId(storedConversations);
    const activeConversation = storedConversations.find(conversation => conversation.id === activeId);

    currentConvIdRef.current = activeId;
    setConversations(storedConversations);
    setPromptTemplates(loadStoredPromptTemplates());
    const storedProviderPresets = loadStoredProviderPresets();
    setProviderPresets(storedProviderPresets);
    setActiveProviderPresetId(loadActiveProviderPresetId(storedProviderPresets));
    setCurrentConvId(activeId);
    loadMessages(activeConversation?.messages ?? []);
    loadDraftIntoState(activeId);
  }, [loadDraftIntoState, loadMessages]);

  const handleNewChat = () => {
    persistCurrentDraft();
    currentConvIdRef.current = null;
    clearMessages();
    setCurrentConvId(null);
    saveActiveConversationId(null);
    loadDraftIntoState(null);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    persistCurrentDraft();
    currentConvIdRef.current = conversation.id;
    setCurrentConvId(conversation.id);
    saveActiveConversationId(conversation.id);
    loadMessages(conversation.messages);
    loadDraftIntoState(conversation.id);
  };

  const handleSend = async (content: string, files?: File[]) => {
    const draftConversationId = currentConvIdRef.current;

    if (!currentConvIdRef.current) {
      const nextId = createId();
      currentConvIdRef.current = nextId;
      setCurrentConvId(nextId);
      saveActiveConversationId(nextId);
    }

    const accepted = await sendMessage(content, files);
    if (accepted) {
      draftTextRef.current = '';
      setDraftText('');
      clearDraftForConversation(draftConversationId);
    }

    return accepted;
  };

  const handleDeleteConversation = (conversationId: string) => {
    const nextConversations = conversations.filter(conversation => conversation.id !== conversationId);
    const deletingCurrentConversation = currentConvIdRef.current === conversationId;
    const nextActive = deletingCurrentConversation ? nextConversations[0] ?? null : null;

    setConversations(nextConversations);
    saveConversations(nextConversations);
    deleteDraftForConversation(conversationId);

    if (deletingCurrentConversation) {
      currentConvIdRef.current = nextActive?.id ?? null;
      setCurrentConvId(nextActive?.id ?? null);
      saveActiveConversationId(nextActive?.id ?? null);
      loadMessages(nextActive?.messages ?? []);
      loadDraftIntoState(nextActive?.id ?? null);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const handleCopyMessage = async (message: Message) => {
    await copyToClipboard(message.content);
  };

  const handleCopyCode = async (code: string) => {
    await copyToClipboard(code);
  };

  const handleRegenerate = async () => {
    if (isLoading) return;
    const previousMessages = messages;
    const nextMessages = removeLatestAssistantMessage();
    const accepted = await resendFromMessages(nextMessages);
    if (!accepted) {
      restoreMessages(previousMessages);
    }
  };

  const handleEditResend = (message: Message) => {
    if (message.role !== 'user') return;
    handleDraftChange(message.content);
  };

  const activeProviderPreset = providerPresets.find(preset => preset.id === activeProviderPresetId);

  const openSettings = () => {
    setPresetDraft(EMPTY_PROVIDER_PRESET_FORM);
    setShowSettings(true);
  };

  const openNewProviderPreset = () => {
    setPresetDraft(EMPTY_PROVIDER_PRESET_FORM);
  };

  const openEditProviderPreset = (preset: ProviderPreset) => {
    setPresetDraft({
      id: preset.id,
      name: preset.name,
      baseUrl: preset.baseUrl ?? '',
      model: preset.model ?? '',
      supportsAttachments: preset.supportsAttachments ?? false,
    });
  };

  const saveProviderPreset = () => {
    const now = Date.now();
    const normalizedPreset = normalizeProviderSettings(presetDraft);
    const name = presetDraft.name.trim() || normalizedPreset.model || 'Provider preset';
    const nextPresets = presetDraft.id
      ? providerPresets.map(preset =>
          preset.id === presetDraft.id
            ? { ...preset, ...normalizedPreset, name, updatedAt: now }
            : preset
        )
      : [
          ...providerPresets,
          {
            id: createId(),
            name,
            ...normalizedPreset,
            createdAt: now,
            updatedAt: now,
          },
        ];

    setProviderPresets(nextPresets);
    saveProviderPresets(nextPresets);
    const nextActiveId = activeProviderPresetId ?? nextPresets[0]?.id ?? null;
    setActiveProviderPresetId(nextActiveId);
    saveActiveProviderPresetId(nextActiveId);
    setPresetDraft(EMPTY_PROVIDER_PRESET_FORM);
  };

  const activateProviderPreset = (presetId: string) => {
    setActiveProviderPresetId(presetId);
    saveActiveProviderPresetId(presetId);
  };

  const deleteProviderPreset = (presetId: string) => {
    const nextPresets = providerPresets.filter(preset => preset.id !== presetId);
    const nextActiveId = activeProviderPresetId === presetId ? nextPresets[0]?.id ?? null : activeProviderPresetId;
    setProviderPresets(nextPresets);
    setActiveProviderPresetId(nextActiveId);
    saveProviderPresets(nextPresets);
    saveActiveProviderPresetId(nextActiveId);
    if (presetDraft.id === presetId) {
      setPresetDraft(EMPTY_PROVIDER_PRESET_FORM);
    }
  };

  const openNewTemplate = () => {
    setTemplateDraft(EMPTY_TEMPLATE_FORM);
    setShowTemplateEditor(true);
  };

  const openEditTemplate = (template: PromptTemplate) => {
    setTemplateDraft({
      id: template.id,
      title: template.title,
      content: template.content,
    });
    setShowTemplateEditor(true);
  };

  const saveTemplate = () => {
    const content = templateDraft.content.trim();
    if (!content) return;

    const now = Date.now();
    const title = templateDraft.title.trim() || createTemplateTitle(content);
    const nextTemplates = templateDraft.id
      ? promptTemplates.map(template =>
          template.id === templateDraft.id
            ? { ...template, title, content, updatedAt: now }
            : template
        )
      : [
          {
            id: createId(),
            title,
            content,
            createdAt: now,
            updatedAt: now,
          },
          ...promptTemplates,
        ];

    setPromptTemplates(nextTemplates);
    savePromptTemplates(nextTemplates);
    setShowTemplateEditor(false);
    setTemplateDraft(EMPTY_TEMPLATE_FORM);
  };

  const deleteTemplate = (templateId: string) => {
    const nextTemplates = promptTemplates.filter(template => template.id !== templateId);
    setPromptTemplates(nextTemplates);
    savePromptTemplates(nextTemplates);
  };

  const insertTemplateIntoDraft = (template: PromptTemplate) => {
    const separator = draftTextRef.current && !draftTextRef.current.endsWith('\n') ? '\n' : '';
    handleDraftChange(`${draftTextRef.current}${separator}${template.content}`);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {showSidebar && (
        <div className="flex w-64 flex-col border-r border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-4">
            <button
              onClick={handleNewChat}
              className="w-full rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
              type="button"
            >
              + New chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map(conversation => (
              <div
                key={conversation.id}
                className={`group flex w-full items-center gap-2 border-b border-gray-100 px-3 py-3 hover:bg-gray-100 ${
                  currentConvId === conversation.id ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
                }`}
              >
                <button
                  onClick={() => handleSelectConversation(conversation)}
                  className="min-w-0 flex-1 text-left"
                  type="button"
                >
                  <div className="truncate text-sm font-medium text-gray-900">{conversation.title}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(conversation.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteConversation(conversation.id)}
                  className="rounded p-1 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  title="Delete conversation"
                  aria-label={`Delete conversation ${conversation.title}`}
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M10 11v6m4-6v6m1-10V5a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m-2 0l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="border-t border-gray-200 px-3 py-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Templates</h2>
                <button
                  onClick={openNewTemplate}
                  className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                  type="button"
                >
                  Add
                </button>
              </div>

              {promptTemplates.length > 0 ? (
                <div className="space-y-2">
                  {promptTemplates.map(template => (
                    <div key={template.id} className="rounded-md border border-gray-200 p-2">
                      <button
                        onClick={() => insertTemplateIntoDraft(template)}
                        className="block w-full text-left"
                        title="Insert template"
                        type="button"
                      >
                        <div className="truncate text-sm font-medium text-gray-900">{template.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-gray-500">{template.content}</div>
                      </button>
                      <div className="mt-2 flex justify-end gap-1">
                        <button
                          onClick={() => openEditTemplate(template)}
                          className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500">
                  No templates yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
            title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-lg font-semibold text-gray-900">
            {currentConvId ? conversations.find(conversation => conversation.id === currentConvId)?.title || 'Chat' : 'New chat'}
          </h1>

          <div className="flex items-center gap-1">
            <button
              onClick={openSettings}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600"
              title="Settings"
              aria-label="Settings"
              type="button"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.89 3.31.877 2.42 2.42a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.89 1.543-.877 3.31-2.42 2.42a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.89-3.31-.877-2.42-2.42a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.89-1.543.877-3.31 2.42-2.42.996.574 2.25.055 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={clearMessages}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500"
              title="Clear conversation"
              aria-label="Clear conversation"
              type="button"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <MessageList
          messages={messages}
          isLoading={isLoading}
          onCopyMessage={handleCopyMessage}
          onCopyCode={handleCopyCode}
          onRegenerate={handleRegenerate}
          onEditResend={handleEditResend}
        />

        {error && (
          <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <InputArea
          value={draftText}
          onChange={handleDraftChange}
          onSend={handleSend}
          onStop={stopGeneration}
          isLoading={isLoading}
          templates={promptTemplates}
          supportsAttachments={activeProviderPreset?.supportsAttachments ?? true}
        />
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Provider presets</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                title="Close"
                aria-label="Close settings"
                type="button"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-md border border-gray-200 p-3 text-sm text-gray-700">
              Active: {activeProviderPreset ? activeProviderPreset.name : 'Environment defaults'}
              <div className="mt-1 text-xs text-gray-500">
                Attachments: {activeProviderPreset ? (activeProviderPreset.supportsAttachments ? 'enabled by active preset' : 'disabled by active preset') : 'controlled by environment defaults'}
              </div>
            </div>

            <div className="mb-4 grid gap-2">
              {providerPresets.map(preset => (
                <div key={preset.id} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 p-3">
                  <button
                    onClick={() => activateProviderPreset(preset.id)}
                    className={`rounded px-2 py-1 text-xs ${
                      preset.id === activeProviderPresetId ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                    type="button"
                  >
                    {preset.id === activeProviderPresetId ? 'Active' : 'Activate'}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{preset.name}</div>
                    <div className="truncate text-xs text-gray-500">
                      {preset.model || 'env model'} at {preset.baseUrl || 'env base URL'}
                    </div>
                  </div>
                  <button
                    onClick={() => openEditProviderPreset(preset)}
                    className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProviderPreset(preset.id)}
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <div className="mb-4 rounded-md border border-gray-200 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {presetDraft.id ? 'Edit preset' : 'New preset'}
                </h3>
                <button
                  onClick={openNewProviderPreset}
                  className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                  type="button"
                >
                  Clear
                </button>
              </div>

              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Name</span>
                <input
                  value={presetDraft.name}
                  onChange={event => setPresetDraft(previous => ({ ...previous, name: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-gray-700">API Base URL</span>
                <input
                  value={presetDraft.baseUrl}
                  onChange={event => setPresetDraft(previous => ({ ...previous, baseUrl: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Model name</span>
                <input
                  value={presetDraft.model}
                  onChange={event => setPresetDraft(previous => ({ ...previous, model: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={presetDraft.supportsAttachments}
                  onChange={event => setPresetDraft(previous => ({ ...previous, supportsAttachments: event.target.checked }))}
                />
                Enable image attachment passthrough
              </label>
            </div>

            <p className="mb-4 text-xs text-gray-500">
              API keys still come from `.env.local`; presets store only provider URL, model, and capability hints.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={saveProviderPreset}
                className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600"
                type="button"
              >
                Save preset
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplateEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {templateDraft.id ? 'Edit template' : 'New template'}
              </h2>
              <button
                onClick={() => setShowTemplateEditor(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                title="Close"
                aria-label="Close template editor"
                type="button"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
              <input
                value={templateDraft.title}
                onChange={event => setTemplateDraft(previous => ({ ...previous, title: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Content</span>
              <textarea
                value={templateDraft.content}
                onChange={event => setTemplateDraft(previous => ({ ...previous, content: event.target.value }))}
                className="min-h-36 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTemplateEditor(false)}
                className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={!templateDraft.content.trim()}
                className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                Save
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
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed as Conversation[] : [];
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
  return conversations.some(conversation => conversation.id === activeId) ? activeId : conversations[0]?.id ?? null;
}

function saveActiveConversationId(conversationId: string | null) {
  if (typeof window === 'undefined') return;

  if (conversationId) {
    window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId);
  } else {
    window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }
}

function loadDraftForConversation(conversationId: string | null): string {
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

function saveDraftForConversation(conversationId: string | null, draft: string) {
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

function clearDraftForConversation(conversationId: string | null) {
  saveDraftForConversation(conversationId, '');
}

function deleteDraftForConversation(conversationId: string) {
  const drafts = loadConversationDrafts();
  delete drafts[conversationId];
  saveConversationDrafts(drafts);
}

function loadConversationDrafts(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const saved = window.localStorage.getItem(CONVERSATION_DRAFTS_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : {};

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'string')
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveConversationDrafts(drafts: Record<string, string>) {
  if (typeof window === 'undefined') return;

  if (Object.keys(drafts).length > 0) {
    window.localStorage.setItem(CONVERSATION_DRAFTS_KEY, JSON.stringify(drafts));
  } else {
    window.localStorage.removeItem(CONVERSATION_DRAFTS_KEY);
  }
}

function loadStoredPromptTemplates(): PromptTemplate[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(PROMPT_TEMPLATES_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isPromptTemplate);
  } catch {
    return [];
  }
}

function savePromptTemplates(templates: PromptTemplate[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROMPT_TEMPLATES_KEY, JSON.stringify(templates));
}

function loadStoredProviderPresets(): ProviderPreset[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(PROVIDER_PRESETS_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(isProviderPreset);
      }
      return [];
    }

    return migrateLegacyProviderSettings();
  } catch {
    return [];
  }
}

function saveProviderPresets(presets: ProviderPreset[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROVIDER_PRESETS_KEY, JSON.stringify(presets));
}

function loadActiveProviderPresetId(presets = loadStoredProviderPresets()): string | null {
  if (typeof window === 'undefined') return presets[0]?.id ?? null;

  const saved = window.localStorage.getItem(ACTIVE_PROVIDER_PRESET_KEY);
  return presets.some(preset => preset.id === saved) ? saved : presets[0]?.id ?? null;
}

function saveActiveProviderPresetId(presetId: string | null) {
  if (typeof window === 'undefined') return;

  if (presetId) {
    window.localStorage.setItem(ACTIVE_PROVIDER_PRESET_KEY, presetId);
  } else {
    window.localStorage.removeItem(ACTIVE_PROVIDER_PRESET_KEY);
  }
}

async function readActiveProviderSettings(): Promise<ProviderSettings | undefined> {
  if (typeof window === 'undefined') return undefined;

  const presets = loadStoredProviderPresets();
  const activePresetId = loadActiveProviderPresetId(presets);
  const activePreset = presets.find(preset => preset.id === activePresetId);
  if (activePreset) {
    return emptyToUndefined(normalizeProviderSettings(activePreset));
  }

  return readStoredProviderSettings();
}

function migrateLegacyProviderSettings(): ProviderPreset[] {
  const legacySettings = readLegacyProviderSettings();
  if (!legacySettings) return [];

  const preset: ProviderPreset = {
    id: createId(),
    name: legacySettings.model || 'Legacy provider preset',
    ...legacySettings,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  window.localStorage.removeItem(PROVIDER_SETTINGS_KEY);
  saveProviderPresets([preset]);
  saveActiveProviderPresetId(preset.id);
  return [preset];
}

function createConversationTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(message => message.role === 'user' && message.content.trim());
  const title = firstUserMessage?.content.trim() || 'New chat';
  return title.length > 30 ? `${title.slice(0, 30)}...` : title;
}

function createTemplateTitle(content: string): string {
  const firstLine = content.split(/\r?\n/).find(line => line.trim())?.trim() || 'Untitled template';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPromptTemplate(value: unknown): value is PromptTemplate {
  if (!value || typeof value !== 'object') return false;
  const template = value as Partial<PromptTemplate>;
  return (
    typeof template.id === 'string' &&
    typeof template.title === 'string' &&
    typeof template.content === 'string' &&
    typeof template.createdAt === 'number' &&
    typeof template.updatedAt === 'number'
  );
}

function isProviderPreset(value: unknown): value is ProviderPreset {
  if (!value || typeof value !== 'object') return false;
  const preset = value as Partial<ProviderPreset>;
  return (
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.createdAt === 'number' &&
    typeof preset.updatedAt === 'number' &&
    (preset.baseUrl === undefined || typeof preset.baseUrl === 'string') &&
    (preset.model === undefined || typeof preset.model === 'string') &&
    (preset.supportsAttachments === undefined || typeof preset.supportsAttachments === 'boolean')
  );
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

function readLegacyProviderSettings(): ProviderSettings | undefined {
  if (typeof window === 'undefined') return undefined;

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
