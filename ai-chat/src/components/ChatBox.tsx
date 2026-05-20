'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { useChat } from '@/hooks/useChat';
import {
  ACTIVE_PROVIDER_PRESET_KEY,
  CONVERSATION_DRAFTS_KEY,
  CONVERSATIONS_KEY,
  PROMPT_TEMPLATES_KEY,
  PROVIDER_PRESETS_KEY,
  PROVIDER_SETTINGS_KEY,
  clearDraftForConversation,
  createProviderSnapshot,
  createStorageId,
  deleteDraftForConversation,
  loadActiveProviderPresetId,
  loadDraftForConversation,
  loadInitialConversationId,
  loadStoredConversations,
  loadStoredPromptTemplates,
  loadStoredProviderPresets,
  normalizeProviderSettings,
  pruneConversationDrafts,
  readActiveProviderSettings,
  saveActiveConversationId,
  saveActiveProviderPresetId,
  saveConversations,
  saveDraftForConversation,
  savePromptTemplates,
  saveProviderPresets,
  validateProviderSettings,
} from '@/lib/storage';
import { Conversation, Message, PromptTemplate, ProviderPreset, ProviderSnapshot } from '@/types/chat';

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

interface AboutInfo {
  version: string;
  platform: string;
}

interface DiagnosticsInfo {
  logsPath: string;
  lastStartupDiagnostic: unknown;
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
  const [showAbout, setShowAbout] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<TemplateFormDraft>(EMPTY_TEMPLATE_FORM);
  const [providerPresets, setProviderPresets] = useState<ProviderPreset[]>([]);
  const [activeProviderPresetId, setActiveProviderPresetId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<ProviderPresetFormDraft>(EMPTY_PROVIDER_PRESET_FORM);
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [providerCheckState, setProviderCheckState] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null);
  const [diagnosticsInfo, setDiagnosticsInfo] = useState<DiagnosticsInfo | null>(null);
  const [logActionStatus, setLogActionStatus] = useState<string | null>(null);
  const [providerCheckInFlight, setProviderCheckInFlight] = useState(false);
  const currentConvIdRef = useRef<string | null>(currentConvId);
  const draftTextRef = useRef('');
  const conversationButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const providerSnapshotRef = useRef<ProviderSnapshot>(createProviderSnapshot());

  const currentConversation = conversations.find(conversation => conversation.id === currentConvId) ?? null;
  const activeProviderPreset = providerPresets.find(preset => preset.id === activeProviderPresetId) ?? null;
  const activeProviderSnapshot = useMemo(() => createProviderSnapshot(activeProviderPreset ?? undefined), [activeProviderPreset]);
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter(conversation => {
      if (conversation.title.toLowerCase().includes(query)) return true;
      return conversation.messages.some(message =>
        message.content.toLowerCase().includes(query) ||
        message.attachments?.some(attachment => attachment.name.toLowerCase().includes(query))
      );
    });
  }, [conversations, searchQuery]);

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
        provider: existing?.provider ?? providerSnapshotRef.current,
      };

      const nextConversations = [nextConversation, ...previous.filter(conversation => conversation.id !== conversationId)];
      saveConversations(nextConversations);
      return nextConversations;
    });
  }, []);

  const getSettings = useCallback(async () => readActiveProviderSettings(), []);

  const {
    messages,
    isLoading,
    error,
    errorState,
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
    const activeConversation = storedConversations.find(conversation => conversation.id === activeId) ?? null;

    currentConvIdRef.current = activeId;
    setConversations(storedConversations);
    setPromptTemplates(loadStoredPromptTemplates());
    const storedProviderPresets = loadStoredProviderPresets();
    setProviderPresets(storedProviderPresets);
    const storedActiveProviderPresetId = loadActiveProviderPresetId(storedProviderPresets);
    setActiveProviderPresetId(storedActiveProviderPresetId);
    setCurrentConvId(activeId);
    loadMessages(activeConversation?.messages ?? []);
    loadDraftIntoState(activeId);
    providerSnapshotRef.current = activeConversation?.provider ?? createProviderSnapshot(storedProviderPresets.find(preset => preset.id === storedActiveProviderPresetId) ?? undefined);
  }, [loadDraftIntoState, loadMessages]);

  useEffect(() => {
    providerSnapshotRef.current = activeProviderSnapshot;
  }, [activeProviderSnapshot]);

  useEffect(() => {
    if (showAbout && window.aiChat) {
      if (!aboutInfo && window.aiChat.getAppInfo) {
        void window.aiChat.getAppInfo().then(setAboutInfo).catch(() => setAboutInfo(null));
      }
      if (!diagnosticsInfo && window.aiChat.getDiagnostics) {
        void window.aiChat.getDiagnostics().then(setDiagnosticsInfo).catch(() => setDiagnosticsInfo(null));
      }
    }
  }, [aboutInfo, diagnosticsInfo, showAbout]);

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
    providerSnapshotRef.current = conversation.provider ?? activeProviderSnapshot;
    loadMessages(conversation.messages);
    loadDraftIntoState(conversation.id);
  };

  const handleSend = async (content: string, files?: File[]) => {
    const draftConversationId = currentConvIdRef.current;

    if (!currentConvIdRef.current) {
      const nextId = createStorageId();
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

  const handleStartRename = (conversation: Conversation) => {
    setRenameConversationId(conversation.id);
    setRenameDraft(conversation.title);
  };

  const handleSaveRename = () => {
    const conversationId = renameConversationId;
    if (!conversationId) return;

    const title = renameDraft.trim();
    if (!title) return;

    const nextConversations = conversations.map(conversation =>
      conversation.id === conversationId ? { ...conversation, title, updatedAt: Date.now() } : conversation
    );
    setConversations(nextConversations);
    saveConversations(nextConversations);
    setRenameConversationId(null);
    setRenameDraft('');
  };

  const handleConversationKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, conversationId: string) => {
    const index = filteredConversations.findIndex(conversation => conversation.id === conversationId);
    if (index < 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = event.key === 'ArrowDown' ? index + 1 : index - 1;
      const nextConversation = filteredConversations[nextIndex];
      conversationButtonRefs.current[nextConversation?.id ?? '']?.focus();
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

  const saveProviderPreset = () => {
    setProviderError(null);
    const now = Date.now();
    const validation = validateProviderSettings(normalizeProviderSettings(presetDraft));
    if (!validation.ok) {
      setProviderError(validation.message || 'Provider preset is invalid.');
      return;
    }

    const normalizedPreset = validation.settings ?? {};
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
            id: createStorageId(),
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

  const openEditProviderPreset = (preset: ProviderPreset) => {
    setPresetDraft({
      id: preset.id,
      name: preset.name,
      baseUrl: preset.baseUrl ?? '',
      model: preset.model ?? '',
      supportsAttachments: preset.supportsAttachments ?? false,
    });
    setProviderError(null);
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

  const checkProviderPreset = async () => {
    setProviderCheckInFlight(true);
    setProviderCheckState(null);
    setProviderError(null);

    try {
      const response = await fetch('/api/provider/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: activeProviderPreset ? normalizeProviderSettings(activeProviderPreset) : undefined }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        setProviderCheckState(payload?.error || 'Provider connectivity check failed.');
        return;
      }

      setProviderCheckState(`Reachable: ${payload.model || activeProviderPreset?.model || 'model configured'}`);
    } catch (error) {
      setProviderCheckState(error instanceof Error ? error.message : 'Provider connectivity check failed.');
    } finally {
      setProviderCheckInFlight(false);
    }
  };

  const openSettings = () => {
    setPresetDraft(EMPTY_PROVIDER_PRESET_FORM);
    setProviderError(null);
    setProviderCheckState(null);
    setShowSettings(true);
  };

  const openAbout = () => {
    setAboutInfo(null);
    setDiagnosticsInfo(null);
    setLogActionStatus(null);
    setShowAbout(true);
  };

  const exportLogs = async () => {
    if (!window.aiChat?.exportLogs) return;
    const result = await window.aiChat.exportLogs();
    setLogActionStatus(`Exported sanitized logs: ${result.path}`);
  };

  const openLogs = async () => {
    if (!window.aiChat?.openLogs) return;
    const result = await window.aiChat.openLogs();
    setLogActionStatus(result.error ? result.error : `Opened sanitized logs: ${result.path}`);
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
            id: createStorageId(),
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

  const cleanDrafts = () => {
    pruneConversationDrafts(conversations.map(conversation => conversation.id));
    if (!currentConvIdRef.current && !draftTextRef.current.trim()) {
      saveDraftForConversation(null, '');
    }
  };

  const currentProviderLabel = activeProviderPreset?.name || activeProviderPreset?.model || 'Environment defaults';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {showSidebar && (
        <aside className="flex w-80 max-w-full flex-col border-r border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-4">
            <button
              onClick={handleNewChat}
              className="w-full rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
              type="button"
            >
              + New chat
            </button>
            <label className="mt-3 block">
              <span className="sr-only">Search conversations</span>
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length > 0 ? (
              filteredConversations.map(conversation => (
                <div
                  key={conversation.id}
                  className={`group flex w-full items-center gap-2 border-b border-gray-100 px-3 py-3 hover:bg-gray-100 ${
                    currentConvId === conversation.id ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <button
                    ref={node => {
                      conversationButtonRefs.current[conversation.id] = node;
                    }}
                    onClick={() => handleSelectConversation(conversation)}
                    onKeyDown={event => handleConversationKeyDown(event, conversation.id)}
                    className="min-w-0 flex-1 text-left"
                    type="button"
                  >
                    <div className="truncate text-sm font-medium text-gray-900">{conversation.title}</div>
                    <div className="mt-1 text-xs text-gray-500">{new Date(conversation.updatedAt).toLocaleDateString()}</div>
                  </button>
                  <button
                    onClick={() => handleStartRename(conversation)}
                    className="rounded p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                    title="Rename conversation"
                    aria-label={`Rename conversation ${conversation.title}`}
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2M12 5v14m6-7H6" />
                    </svg>
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
              ))
            ) : (
              <div className="px-4 py-8 text-sm text-gray-500">
                No matching conversations
              </div>
            )}

            <div className="border-t border-gray-200 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Templates</h2>
                <button onClick={openNewTemplate} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50" type="button">Add</button>
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
                        <button onClick={() => openEditTemplate(template)} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" type="button">Edit</button>
                        <button onClick={() => deleteTemplate(template.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" type="button">Delete</button>
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

            <div className="border-t border-gray-200 px-3 py-3 text-xs text-gray-500">
              <div className="flex items-center justify-between">
                <span>{filteredConversations.length} conversations</span>
                <button onClick={cleanDrafts} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" type="button">
                  Clean drafts
                </button>
              </div>
              <div className="mt-2 break-all text-[11px] text-gray-400">
                Keys: {CONVERSATIONS_KEY}, {CONVERSATION_DRAFTS_KEY}, {PROMPT_TEMPLATES_KEY}, {PROVIDER_PRESETS_KEY}, {ACTIVE_PROVIDER_PRESET_KEY}, {PROVIDER_SETTINGS_KEY}
              </div>
            </div>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
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

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-gray-900">
              {currentConvId ? currentConversation?.title || 'Chat' : 'New chat'}
            </h1>
            <div className="truncate text-xs text-gray-500">
              Provider: {currentProviderLabel}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={openAbout} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700" title="About" aria-label="About" type="button">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 19a7 7 0 100-14 7 7 0 000 14z" />
              </svg>
            </button>
            <button onClick={openSettings} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600" title="Settings" aria-label="Settings" type="button">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.89 3.31.877 2.42 2.42a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.89 1.543-.877 3.31-2.42 2.42a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.89-3.31-.877-2.42-2.42a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.89-1.543.877-3.31 2.42-2.42.996.574 2.25.055 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button onClick={clearMessages} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500" title="Clear conversation" aria-label="Clear conversation" type="button">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </header>

        <MessageList
          messages={messages}
          isLoading={isLoading}
          onCopyMessage={handleCopyMessage}
          onCopyCode={handleCopyCode}
          onRegenerate={handleRegenerate}
          onEditResend={handleEditResend}
        />

        {errorState && errorState.kind !== 'abort' && (
          <div className={`mx-4 mb-2 rounded-lg border px-4 py-2 ${
            errorState.recoverable ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
          }`}>
            <p className="text-sm text-gray-800">{errorState.message}</p>
          </div>
        )}

        {error && !errorState && (
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
              <button onClick={() => setShowSettings(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Close" aria-label="Close settings" type="button">
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
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={checkProviderPreset} className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50" disabled={providerCheckInFlight} type="button">
                  {providerCheckInFlight ? 'Checking...' : 'Check connectivity'}
                </button>
                {providerCheckState && <span className="text-xs text-gray-600">{providerCheckState}</span>}
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
                  <button onClick={() => openEditProviderPreset(preset)} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" type="button">Edit</button>
                  <button onClick={() => deleteProviderPreset(preset.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" type="button">Delete</button>
                </div>
              ))}
            </div>

            <div className="mb-4 rounded-md border border-gray-200 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{presetDraft.id ? 'Edit preset' : 'New preset'}</h3>
                <button onClick={() => setPresetDraft(EMPTY_PROVIDER_PRESET_FORM)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50" type="button">Clear</button>
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

              {providerError && <p className="text-sm text-red-600">{providerError}</p>}
            </div>

            <p className="mb-4 text-xs text-gray-500">
              API keys still come from `.env.local`; presets store only provider URL, model, and capability hints.
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSettings(false)} className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" type="button">Cancel</button>
              <button onClick={saveProviderPreset} className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600" type="button">Save preset</button>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">About</h2>
              <button onClick={() => setShowAbout(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Close" aria-label="Close about" type="button">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <div>Version: {aboutInfo?.version ?? 'Unavailable'}</div>
              <div>Platform: {aboutInfo?.platform ?? 'Unavailable'}</div>
              <div>Conversation store: localStorage</div>
              <div className="break-all">Log path: {diagnosticsInfo?.logsPath ?? 'Unavailable'}</div>
              <div>Startup: {formatDiagnostic(diagnosticsInfo?.lastStartupDiagnostic)}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={exportLogs} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200" type="button">Export logs</button>
              <button onClick={openLogs} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200" type="button">Open logs</button>
            </div>
            {logActionStatus && <p className="mt-3 break-all text-xs text-gray-500">{logActionStatus}</p>}
          </div>
        </div>
      )}

      {showTemplateEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{templateDraft.id ? 'Edit template' : 'New template'}</h2>
              <button onClick={() => setShowTemplateEditor(false)} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Close" aria-label="Close template editor" type="button">
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
              <button onClick={() => setShowTemplateEditor(false)} className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" type="button">Cancel</button>
              <button onClick={saveTemplate} disabled={!templateDraft.content.trim()} className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50" type="button">Save</button>
            </div>
          </div>
        </div>
      )}

      {renameConversationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Rename conversation</h2>
            <input
              value={renameDraft}
              onChange={event => setRenameDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSaveRename();
                }
                if (event.key === 'Escape') {
                  setRenameConversationId(null);
                  setRenameDraft('');
                }
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setRenameConversationId(null); setRenameDraft(''); }} className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" type="button">Cancel</button>
              <button onClick={handleSaveRename} className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600" type="button">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

function formatDiagnostic(value: unknown): string {
  if (!value) return 'Unavailable';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'status' in value) {
    return String((value as { status?: unknown }).status ?? 'Unavailable');
  }
  return 'Available';
}
