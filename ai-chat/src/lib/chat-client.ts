import type { ChatErrorKind, Message } from '@/types/chat';

export class ChatSubmissionError extends Error {
  kind: ChatErrorKind;

  constructor(kind: ChatErrorKind, message: string) {
    super(message);
    this.name = 'ChatSubmissionError';
    this.kind = kind;
  }
}

export function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function prepareAttachments(files?: File[]) {
  if (!files?.length) return undefined;

  return Promise.all(
    files.map(async file => {
      const data = await fileToDataUrl(file);
      return {
        id: createMessageId(),
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

export async function readErrorResponse(response: Response): Promise<string> {
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

export function sanitizeClientError(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
    .replace(/(["']?(?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?)[^"',}\s]+(["']?)/gi, '$1***$2')
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, '[local path]')
    .replace(/\/(?:Users|home|var|tmp|etc)\/[^\s"'<>]+/g, '[local path]');
}

export function appendStreamEvents(
  currentContent: string,
  nextContentChunk: string,
  assistantMessageId: string,
  getMessages: () => Message[],
  updateMessages: (messages: Message[]) => void
): string {
  const nextContent = currentContent + nextContentChunk;
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

export function setAssistantMessageStatus(
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

export function markLatestAssistantMessage(
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
