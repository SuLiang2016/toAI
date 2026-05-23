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
  exportAppBackup,
  getStorageHealthSummary,
  loadActiveProviderPresetId,
  loadDraftForConversation,
  loadInitialConversationId,
  loadStoredConversations,
  loadStoredPromptTemplates,
  loadStoredProviderPresets,
  normalizeProviderCapabilities,
  normalizeProviderSettings,
  parseAppBackupJson,
  pruneConversationDrafts,
  readActiveProviderSettings,
  restoreAppBackup,
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
  supportsImages: false,
  streaming: true,
  maxImageAttachmentBytes: '',
  maxTextFileBytes: '',
};

export default function ChatBox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
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
  const [backupActionStatus, setBackupActionStatus] = useState<string | null>(null);
  const [logActionStatus, setLogActionStatus] = useState<string | null>(null);
  const [providerCheckInFlight, setProviderCheckInFlight] = useState(false);
  const currentConvIdRef = useRef<string | null>(currentConvId);
  const draftTextRef = useRef('');
  const restoreBackupInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const conversationButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const providerSnapshotRef = useRef<ProviderSnapshot>(createProviderSnapshot());

  const currentConversation = conversations.find(conversation => conversation.id === currentConvId) ?? null;
  const activeProviderPreset = providerPresets.find(preset => preset.id === activeProviderPresetId) ?? null;
  const activeProviderSnapshot = useMemo(() => createProviderSnapshot(activeProviderPreset ?? undefined), [activeProviderPreset]);
  const activeProviderCapabilities = useMemo(
    () => activeProviderPreset
      ? normalizeProviderCapabilities(activeProviderPreset)
      : normalizeProviderCapabilities({
          supportsAttachments: true,
          capabilities: {
            supportsAttachments: true,
            supportsImages: true,
            maxImageAttachmentBytes: 5 * 1024 * 1024,
            maxTextFileBytes: 256 * 1024,
            streaming: true,
          },
        }),
    [activeProviderPreset]
  );
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const scopedConversations = conversations.filter(conversation => Boolean(conversation.archived) === showArchived);
    const searchedConversations = !query
      ? scopedConversations
      : scopedConversations.filter(conversation => {
          if (conversation.title.toLowerCase().includes(query)) return true;
          return conversation.messages.some(message =>
            message.content.toLowerCase().includes(query) ||
            message.attachments?.some(attachment => attachment.name.toLowerCase().includes(query))
          );
        });

    return [...searchedConversations].sort((left, right) => {
      if (Boolean(left.pinned) !== Boolean(right.pinned)) {
        return left.pinned ? -1 : 1;
      }
      return right.updatedAt - left.updatedAt;
    });
  }, [conversations, searchQuery, showArchived]);
  const archivedCount = useMemo(
    () => conversations.filter(conversation => conversation.archived).length,
    [conversations]
  );
  const storageHealth = getStorageHealthSummary();
  const storageWarning = storageHealth.overSoftLimit
    ? `Local AI Chat data is ${formatBytes(storageHealth.appDataBytes)}. Export a backup or clean drafts before this grows further.`
    : null;
  const recoveryHint = storageHealth.quarantinedRecordCount > 0
    ? `${storageHealth.quarantinedRecordCount} corrupted local record(s) were quarantined earlier. Export a backup after verifying your active conversations.`
    : null;
  const storageHealthSummary = `App-owned local data uses ${formatBytes(storageHealth.appDataBytes)} of a ${formatBytes(storageHealth.softLimitBytes)} soft limit.`;

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

  const handleNewChat = useCallback(() => {
    persistCurrentDraft();
    currentConvIdRef.current = null;
    clearMessages();
    setCurrentConvId(null);
    saveActiveConversationId(null);
    loadDraftIntoState(null);
  }, [clearMessages, loadDraftIntoState, persistCurrentDraft]);

  const handleSelectConversation = (conversation: Conversation) => {
    persistCurrentDraft();
    currentConvIdRef.current = conversation.id;
    setCurrentConvId(conversation.id);
    saveActiveConversationId(conversation.id);
    providerSnapshotRef.current = conversation.provider ?? activeProviderSnapshot;
    loadMessages(conversation.messages);
    loadDraftIntoState(conversation.id);
  };

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!showSidebar) {
          setShowSidebar(true);
        }
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleNewChat();
        return;
      }

      if (event.altKey && event.key.toLowerCase() === 'a' && !isEditableTarget) {
        event.preventDefault();
        setShowArchived(previous => !previous);
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [handleNewChat, showSidebar]);

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

  const updateConversationList = (updater: (conversation: Conversation) => Conversation) => {
    const nextConversations = conversations.map(conversation => updater(conversation));
    setConversations(nextConversations);
    saveConversations(nextConversations);
  };

  const toggleConversationPinned = (conversationId: string) => {
    updateConversationList(conversation =>
      conversation.id === conversationId
        ? { ...conversation, pinned: !conversation.pinned, updatedAt: Date.now() }
        : conversation
    );
  };

  const toggleConversationArchived = (conversationId: string) => {
    updateConversationList(conversation =>
      conversation.id === conversationId
        ? { ...conversation, archived: !conversation.archived, updatedAt: Date.now(), pinned: conversation.archived ? conversation.pinned : false }
        : conversation
    );
  };

  const handleConversationKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, conversationId: string) => {
    const index = filteredConversations.findIndex(conversation => conversation.id === conversationId);
    if (index < 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = event.key === 'ArrowDown' ? index + 1 : index - 1;
      const nextConversation = filteredConversations[nextIndex];
      conversationButtonRefs.current[nextConversation?.id ?? '']?.focus();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      conversationButtonRefs.current[filteredConversations[0]?.id ?? '']?.focus();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      conversationButtonRefs.current[filteredConversations[filteredConversations.length - 1]?.id ?? '']?.focus();
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

  const buildProviderSettingsFromDraft = (draft: ProviderPresetFormDraft) => normalizeProviderSettings({
    baseUrl: draft.baseUrl,
    model: draft.model,
    supportsAttachments: draft.supportsAttachments,
    capabilities: {
      supportsAttachments: draft.supportsAttachments,
      supportsImages: draft.supportsImages,
      streaming: draft.streaming,
      maxImageAttachmentBytes: parsePositiveInteger(draft.maxImageAttachmentBytes) ?? 5 * 1024 * 1024,
      maxTextFileBytes: parsePositiveInteger(draft.maxTextFileBytes) ?? 256 * 1024,
    },
  });

  const saveProviderPreset = () => {
    setProviderError(null);
    const now = Date.now();
    const normalizedDraft = buildProviderSettingsFromDraft(presetDraft);
    const validation = validateProviderSettings(normalizedDraft);
    if (!validation.ok) {
      setProviderError(validation.message || 'Provider preset is invalid.');
      return;
    }

    const normalizedPreset = validation.settings ?? {};
    const name = presetDraft.name.trim() || normalizedPreset.model || 'Provider preset';
    const nextPresets = presetDraft.id
      ? providerPresets.map(preset =>
          preset.id === presetDraft.id
            ? {
                ...preset,
                ...normalizedPreset,
                name,
                updatedAt: now,
                lastCheckedAt: undefined,
                lastCheckStatus: 'unchecked' as const,
              }
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
            lastCheckStatus: 'unchecked' as const,
          },
        ];

    setProviderPresets(nextPresets);
    saveProviderPresets(nextPresets);
    const nextActiveId = activeProviderPresetId ?? nextPresets[0]?.id ?? null;
    setActiveProviderPresetId(nextActiveId);
    saveActiveProviderPresetId(nextActiveId);
    setPresetDraft(EMPTY_PROVIDER_PRESET_FORM);
  };

  const persistProviderPresetList = (nextPresets: ProviderPreset[]) => {
    setProviderPresets(nextPresets);
    saveProviderPresets(nextPresets);
  };

  const updateActiveProviderReachability = (
    status: 'reachable' | 'unreachable',
    overrides?: Partial<ProviderPreset>
  ) => {
    if (!activeProviderPreset) return;

    const checkedAt = Date.now();
    const nextPresets = providerPresets.map(preset =>
      preset.id === activeProviderPreset.id
        ? {
            ...preset,
            ...overrides,
            lastCheckedAt: checkedAt,
            lastCheckStatus: status,
          }
        : preset
    );

    persistProviderPresetList(nextPresets);
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
      supportsImages: preset.capabilities?.supportsImages ?? preset.supportsAttachments ?? false,
      streaming: preset.capabilities?.streaming ?? true,
      maxImageAttachmentBytes: String(preset.capabilities?.maxImageAttachmentBytes ?? ''),
      maxTextFileBytes: String(preset.capabilities?.maxTextFileBytes ?? ''),
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
        updateActiveProviderReachability('unreachable');
        setProviderCheckState(payload?.error || 'Provider connectivity check failed.');
        return;
      }

      updateActiveProviderReachability('reachable', {
        ...(payload?.model ? { model: payload.model } : {}),
        ...(payload?.capabilities ? { capabilities: payload.capabilities } : {}),
      });
      setProviderCheckState(`Reachable: ${payload.model || activeProviderPreset?.model || 'model configured'}`);
    } catch (error) {
      updateActiveProviderReachability('unreachable');
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
    setBackupActionStatus(null);
    setLogActionStatus(null);
    setShowAbout(true);
  };

  const exportBackup = () => {
    try {
      const backup = exportAppBackup();
      const serializedBackup = JSON.stringify(backup, null, 2);
      const backupUrl = URL.createObjectURL(new Blob([serializedBackup], { type: 'application/json' }));
      const downloadLink = document.createElement('a');
      const safeTimestamp = backup.createdAt.replaceAll(':', '-').replaceAll('.', '-');

      downloadLink.href = backupUrl;
      downloadLink.download = `ai-chat-backup-${safeTimestamp}.json`;
      downloadLink.click();
      setBackupActionStatus(`Exported backup created at ${backup.createdAt}.`);
      window.setTimeout(() => URL.revokeObjectURL(backupUrl), 0);
    } catch (error) {
      setBackupActionStatus(error instanceof Error ? error.message : 'Backup export failed.');
    }
  };

  const requestBackupRestore = () => {
    restoreBackupInputRef.current?.click();
  };

  const handleBackupFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const serializedBackup = await file.text();
      const backup = parseAppBackupJson(serializedBackup);
      const confirmation = window.confirm([
        `Restore backup from ${backup.createdAt}?`,
        '',
        'This replaces all current AI Chat local data:',
        `- ${backup.localStorage.conversations.length} conversations`,
        `- ${Object.keys(backup.localStorage.conversationDrafts).length} conversation drafts`,
        `- ${backup.localStorage.promptTemplates.length} prompt templates`,
        `- ${backup.localStorage.providerPresets.length} provider presets`,
        '',
        'The app will reload after a successful restore.',
      ].join('\n'));

      if (!confirmation) {
        setBackupActionStatus('Backup restore cancelled.');
        return;
      }

      restoreAppBackup(backup);
      setBackupActionStatus(`Restored backup from ${backup.createdAt}. Reloading...`);
      window.location.reload();
    } catch (error) {
      setBackupActionStatus(error instanceof Error ? error.message : 'Backup restore failed.');
    }
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
  const currentProviderStatusLabel = activeProviderPreset?.lastCheckStatus ?? 'unchecked';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {showSidebar && (
        <ChatSidebar
          conversations={conversations}
          currentConvId={currentConvId}
          filteredConversations={filteredConversations}
          promptTemplates={promptTemplates}
          searchQuery={searchQuery}
          showArchived={showArchived}
          archivedCount={archivedCount}
          storageWarning={storageWarning}
          recoveryHint={recoveryHint}
          searchInputRef={searchInputRef}
          onSearchChange={setSearchQuery}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onConversationKeyDown={handleConversationKeyDown}
          onSetConversationButtonRef={(conversationId, node) => {
            conversationButtonRefs.current[conversationId] = node;
          }}
          onStartRename={handleStartRename}
          onDeleteConversation={handleDeleteConversation}
          onToggleConversationPinned={toggleConversationPinned}
          onToggleConversationArchived={toggleConversationArchived}
          onToggleArchivedView={() => setShowArchived(previous => !previous)}
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
              Provider: {currentProviderLabel} | {currentProviderStatusLabel}
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
          providerCapabilities={activeProviderCapabilities}
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
          backupActionStatus={backupActionStatus}
          logActionStatus={logActionStatus}
          storageHealthSummary={storageHealthSummary}
          recoveryHint={recoveryHint}
          onClose={() => setShowAbout(false)}
          onExportBackup={exportBackup}
          onRestoreBackup={requestBackupRestore}
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

      <input
        ref={restoreBackupInputRef}
        className="hidden"
        accept="application/json,.json"
        onChange={handleBackupFileSelection}
        type="file"
      />
    </div>
  );
}

function parsePositiveInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 KB';
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
