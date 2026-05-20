import { MutableRefObject, useState, useCallback, useRef } from 'react';
import { consumeSseBuffer, readStreamEventContent, StreamingParseError } from '@/lib/streaming';
import { validateProviderSettings } from '@/lib/storage';
import { ChatErrorKind, ChatErrorState, ChatRequest, Message, ProviderSettings } from '@/types/chat';

interface UseChatOptions {
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  getSettings?: () => Promise<ProviderSettings | undefined>;
}

export function useChat(options?: UseChatOptions) {
  const { initialMessages = [], onMessagesChange, getSettings } = options ?? {};
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
      updateMessages,
      messagesRef,
      setIsLoading,
      setErrorState,
      abortControllerRef,
    });
  }, [getSettings, updateMessages]);

  const resendFromMessages = useCallback(async (nextMessages: Message[]): Promise<boolean> => {
    return submitChatTurn({
      content: '',
      attachments: undefined,
      getSettings,
      updateMessages,
      messagesRef,
      setIsLoading,
      setErrorState,
      abortControllerRef,
      baseMessages: nextMessages,
      skipUserMessageCreation: true,
    });
  }, [getSettings, updateMessages]);

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
          id: createId(),
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
    const providerValidation = validateProviderSettings(await getSettings?.());
    if (!providerValidation.ok) {
      throw new ChatSubmissionError('validation_error', providerValidation.message || 'Provider settings are invalid');
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
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      throw new ChatSubmissionError('upstream_error', await readErrorResponse(response));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ChatSubmissionError('upstream_error', 'AI service returned no response stream');
    }

    const decoder = new TextDecoder();
    let buffered = '';
    let assistantContent = '';
    let sawDone = false;

    const assistantMessage: Message = {
      id: createId(),
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
      assistantContent = appendStreamEvents(result.events, assistantContent, assistantMessage.id, () => messagesRef.current, updateMessages);
    }

    if (buffered.trim()) {
      const result = consumeSseBuffer(`${buffered}\n`);
      sawDone = sawDone || result.done;
      assistantContent = appendStreamEvents(result.events, assistantContent, assistantMessage.id, () => messagesRef.current, updateMessages);
    }

    if (!sawDone) {
      setAssistantMessageStatus(assistantMessage.id, assistantContent ? 'partial' : 'error', () => messagesRef.current, updateMessages);
      throw new ChatSubmissionError('incomplete_stream', 'AI response stream ended before the completion marker');
    }

    setAssistantMessageStatus(assistantMessage.id, 'complete', () => messagesRef.current, updateMessages);
    return true;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      markLatestAssistantMessage('aborted', () => messagesRef.current, updateMessages);
      setErrorState({
        kind: 'abort',
        message: 'Generation stopped. Partial response preserved.',
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
        message: sanitizeClientError(err instanceof Error ? err.message : 'Failed to send message'),
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

function appendStreamEvents(
  events: Parameters<typeof readStreamEventContent>[0],
  currentContent: string,
  assistantMessageId: string,
  getMessages: () => Message[],
  updateMessages: (messages: Message[]) => void
): string {
  const nextContent = currentContent + readStreamEventContent(events);
  if (nextContent === currentContent) return currentContent;

  updateMessages(
    getMessages().map(message =>
      message.id === assistantMessageId
        ? { ...message, content: nextContent, status: 'streaming' }
        : message
    )
  );

  return nextContent;
}

function setAssistantMessageStatus(
  assistantMessageId: string,
  status: Message['status'],
  getMessages: () => Message[],
  updateMessages: (messages: Message[]) => void
) {
  updateMessages(
    getMessages().map(message =>
      message.id === assistantMessageId ? { ...message, status } : message
    )
  );
}

function markLatestAssistantMessage(
  status: Message['status'],
  getMessages: () => Message[],
  updateMessages: (messages: Message[]) => void
) {
  const nextMessages = [...getMessages()];
  for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
    if (nextMessages[i]?.role === 'assistant') {
      nextMessages[i] = { ...nextMessages[i], status };
      updateMessages(nextMessages);
      return;
    }
  }
}

class ChatSubmissionError extends Error {
  kind: ChatErrorKind;

  constructor(kind: ChatErrorKind, message: string) {
    super(message);
    this.name = 'ChatSubmissionError';
    this.kind = kind;
  }
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function prepareAttachments(files?: File[]) {
  if (!files?.length) return undefined;

  return Promise.all(
    files.map(async file => {
      const data = await fileToDataUrl(file);
      return {
        id: createId(),
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
        mimeType: file.type || 'application/octet-stream',
        url: data,
        data,
        size: file.size,
      };
    })
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readErrorResponse(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === 'string') {
      return sanitizeClientError(body.error);
    }
  } catch {
    // Fall through to status text.
  }

  return `AI request failed with HTTP status ${response.status}`;
}

function sanitizeClientError(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
    .replace(/(["']?(?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?)[^"',}\s]+(["']?)/gi, '$1***$2')
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, '[local path]')
    .replace(/\/(?:Users|home|var|tmp|etc)\/[^\s"'<>]+/g, '[local path]');
}
