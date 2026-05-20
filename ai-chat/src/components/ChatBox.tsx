'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import AboutModal from './chatbox/AboutModal';
import ChatSidebar from './chatbox/ChatSidebar';
import ProviderPresetsModal from './chatbox/ProviderPresetsModal';
import RenameConversationModal from './chatbox/RenameConversationModal';
import TemplateEditorModal from './chatbox/TemplateEditorModal';
import { createConversationTitle, createTemplateTitle } from './chatbox/chatbox-utils';
import type {
  AboutInfo,
  DiagnosticsInfo,
  ProviderPresetFormDraft,
  TemplateFormDraft,
} from './chatbox/types';
import { useChat } from '@/hooks/useChat';
import {
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
import type { Conversation, Message, PromptTemplate, ProviderPreset, ProviderSnapshot } from '@/types/chat';

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
        <ChatSidebar
          conversations={conversations}
          currentConvId={currentConvId}
          filteredConversations={filteredConversations}
          promptTemplates={promptTemplates}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onConversationKeyDown={handleConversationKeyDown}
          onSetConversationButtonRef={(conversationId, node) => {
            conversationButtonRefs.current[conversationId] = node;
          }}
          onStartRename={handleStartRename}
          onDeleteConversation={handleDeleteConversation}
          onOpenNewTemplate={openNewTemplate}
          onInsertTemplate={insertTemplateIntoDraft}
          onOpenEditTemplate={openEditTemplate}
          onDeleteTemplate={deleteTemplate}
          onCleanDrafts={cleanDrafts}
        />
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
        <ProviderPresetsModal
          activeProviderPreset={activeProviderPreset}
          activeProviderPresetId={activeProviderPresetId}
          providerPresets={providerPresets}
          presetDraft={presetDraft}
          providerError={providerError}
          providerCheckState={providerCheckState}
          providerCheckInFlight={providerCheckInFlight}
          onClose={() => setShowSettings(false)}
          onCheckProviderPreset={checkProviderPreset}
          onActivateProviderPreset={activateProviderPreset}
          onOpenEditProviderPreset={openEditProviderPreset}
          onDeleteProviderPreset={deleteProviderPreset}
          onPresetDraftChange={setPresetDraft}
          onResetPresetDraft={() => setPresetDraft(EMPTY_PROVIDER_PRESET_FORM)}
          onSaveProviderPreset={saveProviderPreset}
        />
      )}

      {showAbout && (
        <AboutModal
          aboutInfo={aboutInfo}
          diagnosticsInfo={diagnosticsInfo}
          logActionStatus={logActionStatus}
          onClose={() => setShowAbout(false)}
          onExportLogs={exportLogs}
          onOpenLogs={openLogs}
        />
      )}

      {showTemplateEditor && (
        <TemplateEditorModal
          templateDraft={templateDraft}
          onClose={() => setShowTemplateEditor(false)}
          onTemplateDraftChange={setTemplateDraft}
          onSaveTemplate={saveTemplate}
        />
      )}

      {renameConversationId && (
        <RenameConversationModal
          renameDraft={renameDraft}
          onRenameDraftChange={setRenameDraft}
          onClose={() => {
            setRenameConversationId(null);
            setRenameDraft('');
          }}
          onSave={handleSaveRename}
        />
      )}
    </div>
  );
}
