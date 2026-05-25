import { useState, useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useCurrentLocale, useTranslate } from '@/i18n';
import { consumeSseBuffer, readStreamEventContent, StreamingParseError } from '@/lib/streaming';
import { validateProviderSettings } from '@/lib/storage';
import {
  appendStreamEvents,
  ChatSubmissionError,
  createMessageId,
  markLatestAssistantMessage,
  prepareAttachments,
  readErrorResponse,
  sanitizeClientError,
  setAssistantMessageStatus,
} from '@/lib/chat-client';
import type { ChatErrorState, ChatRequest, Message, ProviderSettings } from '@/types/chat';

type TranslateFn = ReturnType<typeof useTranslate>;

interface UseChatOptions {
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  getSettings?: () => Promise<ProviderSettings | undefined>;
}

export function useChat(options?: UseChatOptions) {
  const { initialMessages = [], onMessagesChange, getSettings } = options ?? {};
  const t = useTranslate();
  const { locale } = useCurrentLocale();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<ChatErrorState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>(initialMessages);

  const updateMessages = useCallback((nextMessages: Message[]) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    onMessagesChange?.(nextMessages);
  }, [onMessagesChange]);

  const sendMessage = useCallback(async (content: string, attachments?: File[]): Promise<boolean> => {
    return submitChatTurn({
      content,
      attachments,
      getSettings,
      locale,
      t,
      updateMessages,
      messagesRef,
      setIsLoading,
      setErrorState,
      abortControllerRef,
    });
  }, [getSettings, locale, t, updateMessages]);

  const resendFromMessages = useCallback(async (nextMessages: Message[]): Promise<boolean> => {
    return submitChatTurn({
      content: '',
      attachments: undefined,
      getSettings,
      locale,
      t,
      updateMessages,
      messagesRef,
      setIsLoading,
      setErrorState,
      abortControllerRef,
      baseMessages: nextMessages,
      skipUserMessageCreation: true,
    });
  }, [getSettings, locale, t, updateMessages]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    updateMessages([]);
    setErrorState(null);
  }, [updateMessages]);

  const restoreMessages = useCallback((nextMessages: Message[]) => {
    updateMessages(nextMessages);
  }, [updateMessages]);

  const loadMessages = useCallback((nextMessages: Message[]) => {
    updateMessages(nextMessages);
    setErrorState(null);
  }, [updateMessages]);

  const removeLatestAssistantMessage = useCallback(() => {
    const nextMessages = [...messagesRef.current];
    for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
      if (nextMessages[i]?.role === 'assistant') {
        nextMessages.splice(i, 1);
        break;
      }
    }
    updateMessages(nextMessages);
    return nextMessages;
  }, [updateMessages]);

  return {
    messages,
    isLoading,
    error: errorState?.message ?? null,
    errorState,
    sendMessage,
    resendFromMessages,
    stopGeneration,
    clearMessages,
    restoreMessages,
    loadMessages,
    removeLatestAssistantMessage,
  };
}

interface ChatSubmissionOptions {
  content: string;
  attachments?: File[];
  getSettings?: () => Promise<ProviderSettings | undefined>;
  locale: 'zh-CN' | 'en';
  t: TranslateFn;
  updateMessages: (messages: Message[]) => void;
  messagesRef: MutableRefObject<Message[]>;
  setIsLoading: (loading: boolean) => void;
  setErrorState: (error: ChatErrorState | null) => void;
  abortControllerRef: MutableRefObject<AbortController | null>;
  baseMessages?: Message[];
  skipUserMessageCreation?: boolean;
}

async function submitChatTurn({
  content,
  attachments,
  getSettings,
  locale,
  t,
  updateMessages,
  messagesRef,
  setIsLoading,
  setErrorState,
  abortControllerRef,
  baseMessages,
  skipUserMessageCreation = false,
}: ChatSubmissionOptions): Promise<boolean> {
  try {
    const preparedAttachments = skipUserMessageCreation ? undefined : await prepareAttachments(attachments);
    const userMessage = skipUserMessageCreation
      ? null
      : {
          id: createMessageId(),
          role: 'user' as const,
          content,
          timestamp: Date.now(),
          attachments: preparedAttachments,
        };

    const messagesWithUser = skipUserMessageCreation
      ? baseMessages ?? messagesRef.current
      : [...messagesRef.current, userMessage!];

    updateMessages(messagesWithUser);
    setIsLoading(true);
    setErrorState(null);

    abortControllerRef.current = new AbortController();
    const providerValidation = validateProviderSettings(await getSettings?.(), locale);
    if (!providerValidation.ok) {
      throw new ChatSubmissionError('validation_error', providerValidation.message || t('provider.settingsInvalid'));
    }

    const requestBody: ChatRequest = {
      messages: messagesWithUser.map(message => ({
        role: message.role,
        content: message.content,
        attachments: message.attachments?.map(attachment => ({
          name: attachment.name,
          type: attachment.type,
          mimeType: attachment.mimeType,
          size: attachment.size,
          data: attachment.data,
        })),
      })),
      settings: providerValidation.settings,
      locale,
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      throw new ChatSubmissionError('upstream_error', await readErrorResponse(response, t('chat.requestFailedStatus', { status: response.status })));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ChatSubmissionError('upstream_error', t('chat.emptyResponseStream'));
    }

    const decoder = new TextDecoder();
    let buffered = '';
    let assistantContent = '';
    let sawDone = false;

    const assistantMessage: Message = {
      id: createMessageId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    };

    updateMessages([...messagesWithUser, assistantMessage]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffered += decoder.decode(value, { stream: true });
      const result = consumeSseBuffer(buffered);
      buffered = result.remainder;
      sawDone = sawDone || result.done;
      assistantContent = appendStreamEvents(
        assistantContent,
        readStreamEventContent(result.events),
        assistantMessage.id,
        () => messagesRef.current,
        updateMessages
      );
    }

    if (buffered.trim()) {
      const result = consumeSseBuffer(`${buffered}\n`);
      sawDone = sawDone || result.done;
      assistantContent = appendStreamEvents(
        assistantContent,
        readStreamEventContent(result.events),
        assistantMessage.id,
        () => messagesRef.current,
        updateMessages
      );
    }

    if (!sawDone) {
      setAssistantMessageStatus(assistantMessage.id, assistantContent ? 'partial' : 'error', () => messagesRef.current, updateMessages);
      throw new ChatSubmissionError('incomplete_stream', t('chat.incompleteResponse'));
    }

    setAssistantMessageStatus(assistantMessage.id, 'complete', () => messagesRef.current, updateMessages);
    return true;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      markLatestAssistantMessage('aborted', () => messagesRef.current, updateMessages);
      setErrorState({
        kind: 'abort',
        message: t('chat.generationStopped'),
        recoverable: true,
      });
    } else if (err instanceof ChatSubmissionError) {
      setErrorState({
        kind: err.kind,
        message: sanitizeClientError(err.message),
        recoverable: err.kind !== 'validation_error',
      });
      if (err.kind === 'incomplete_stream') {
        markLatestAssistantMessage('partial', () => messagesRef.current, updateMessages);
      }
    } else if (err instanceof StreamingParseError) {
      markLatestAssistantMessage('error', () => messagesRef.current, updateMessages);
      setErrorState({
        kind: 'incomplete_stream',
        message: sanitizeClientError(err.message),
        recoverable: true,
      });
    } else {
      setErrorState({
        kind: 'network_error',
        message: sanitizeClientError(err instanceof Error ? err.message : t('chat.failedToSend')),
        recoverable: true,
      });
      console.error('Chat error:', err);
    }
    return false;
  } finally {
    setIsLoading(false);
    abortControllerRef.current = null;
  }
}
