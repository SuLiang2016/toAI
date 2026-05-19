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

  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    const preparedAttachments = await prepareAttachments(attachments);
    const userMessage: Message = {
      id: createId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: preparedAttachments,
    };

    const messagesWithUser = [...messagesRef.current, userMessage];
    updateMessages(messagesWithUser);
    setIsLoading(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const requestBody: ChatRequest = {
        messages: messagesWithUser.map(m => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments?.map(attachment => ({
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
        throw new Error('AI 服务没有返回响应流');
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
        throw new Error('AI 响应流提前中断，请稍后重试');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : '发送消息失败');
        console.error('Chat error:', err);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
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

  const loadMessages = useCallback((nextMessages: Message[]) => {
    updateMessages(nextMessages);
    setError(null);
  }, [updateMessages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadMessages,
  };
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
      throw new Error('AI 服务返回了无法解析的流式数据');
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
      return body.error;
    }
  } catch {
    // Fall through to status text.
  }

  return `AI 请求失败，HTTP 状态码 ${response.status}`;
}
