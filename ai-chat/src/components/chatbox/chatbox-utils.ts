import type { Message } from '@/types/chat';

export function createConversationTitle(messages: Message[], fallbackTitle = 'New chat'): string {
  const firstUserMessage = messages.find(message => message.role === 'user' && message.content.trim());
  const title = firstUserMessage?.content.trim() || fallbackTitle;
  return title.length > 30 ? `${title.slice(0, 30)}...` : title;
}

export function createTemplateTitle(content: string, fallbackTitle = 'Untitled template'): string {
  const firstLine = content.split(/\r?\n/).find(line => line.trim())?.trim() || fallbackTitle;
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
}

export function formatDiagnostic(
  value: unknown,
  unavailableLabel = 'Unavailable',
  availableLabel = 'Available'
): string {
  if (!value) return unavailableLabel;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'status' in value) {
    return String((value as { status?: unknown }).status ?? unavailableLabel);
  }
  return availableLabel;
}
