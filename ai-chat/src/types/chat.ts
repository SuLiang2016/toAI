export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  mimeType: string;
  url: string;
  size: number;
  data?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequestAttachment {
  name: string;
  type: Attachment['type'];
  mimeType: string;
  size: number;
  data?: string;
}

export interface ChatRequestMessage {
  role: Message['role'];
  content: string;
  attachments?: ChatRequestAttachment[];
}

export interface ProviderSettings {
  baseUrl?: string;
  model?: string;
  supportsAttachments?: boolean;
}

export interface ChatRequest {
  messages: ChatRequestMessage[];
  settings?: ProviderSettings;
}
