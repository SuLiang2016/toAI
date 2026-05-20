import type { Message } from '@/types/chat';

export function createConversationTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(message => message.role === 'user' && message.content.trim());
  const title = firstUserMessage?.content.trim() || 'New chat';
  return title.length > 30 ? `${title.slice(0, 30)}...` : title;
}

export function createTemplateTitle(content: string): string {
  const firstLine = content.split(/\r?\n/).find(line => line.trim())?.trim() || 'Untitled template';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
}

export function formatDiagnostic(value: unknown): string {
  if (!value) return 'Unavailable';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'status' in value) {
    return String((value as { status?: unknown }).status ?? 'Unavailable');
  }
  return 'Available';
}

