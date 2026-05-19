import { useState, useCallback, useRef } from 'react';
import { ChatRequest, Message, ProviderSettings } from '@/types/chat';

interface UseChatOptions {
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  getSettings?: () => Promise<ProviderSettings | undefined>;
}

export function useChat(options?: UseChatOptions) {
  const { initialMessages = [], onMessagesChange, getSettings } = options ?? {};
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError,
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
      setError,
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
    setError(null);
  }, [updateMessages]);

  const restoreMessages = useCallback((nextMessages: Message[]) => {
    updateMessages(nextMessages);
  }, [updateMessages]);

  const loadMessages = useCallback((nextMessages: Message[]) => {
    updateMessages(nextMessages);
    setError(null);
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
    error,
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
  messagesRef: React.MutableRefObject<Message[]>;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
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
  setError,
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
    setError(null);

    abortControllerRef.current = new AbortController();

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
      settings: await getSettings?.(),
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      throw new Error(await readErrorResponse(response));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('AI service returned no response stream');
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
    };

    updateMessages([...messagesWithUser, assistantMessage]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffered += decoder.decode(value, { stream: true });
      const result = consumeSseBuffer(buffered);
      buffered = result.remainder;
      sawDone = sawDone || result.done;
      assistantContent = applyStreamEvents(
        result.events,
        assistantContent,
        assistantMessage.id,
        () => messagesRef.current,
        updateMessages
      );
    }

    if (buffered.trim()) {
      const result = consumeSseBuffer(`${buffered}\n`);
      sawDone = sawDone || result.done;
      applyStreamEvents(
        result.events,
        assistantContent,
        assistantMessage.id,
        () => messagesRef.current,
        updateMessages
      );
    }

    if (!sawDone) {
      throw new Error('AI response stream ended before the completion marker');
    }

    return true;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      setError(null);
    } else {
      setError(sanitizeClientError(err instanceof Error ? err.message : 'Failed to send message'));
      console.error('Chat error:', err);
    }
    return false;
  } finally {
    setIsLoading(false);
    abortControllerRef.current = null;
  }
}

interface StreamEvent {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

function consumeSseBuffer(buffer: string): { events: StreamEvent[]; remainder: string; done: boolean } {
  const lines = buffer.split(/\r?\n/);
  const remainder = lines.pop() || '';
  const events: StreamEvent[] = [];
  let done = false;

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;

    const data = line.slice(6).trim();
    if (!data) continue;
    if (data === '[DONE]') {
      done = true;
      continue;
    }

    try {
      events.push(JSON.parse(data) as StreamEvent);
    } catch {
      throw new Error('AI service returned invalid streaming data');
    }
  }

  return { events, remainder, done };
}

function applyStreamEvents(
  events: StreamEvent[],
  currentContent: string,
  assistantMessageId: string,
  getMessages: () => Message[],
  updateMessages: (messages: Message[]) => void
): string {
  let nextContent = currentContent;

  for (const event of events) {
    const delta = event.choices?.[0]?.delta?.content;
    if (!delta) continue;

    nextContent += delta;
    updateMessages(
      getMessages().map(message =>
        message.id === assistantMessageId
          ? { ...message, content: nextContent }
          : message
      )
    );
  }

  return nextContent;
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
