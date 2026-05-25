export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  status?: MessageStatus;
}

export type MessageStatus = 'complete' | 'streaming' | 'partial' | 'aborted' | 'error';

export type ChatErrorKind = 'abort' | 'incomplete_stream' | 'upstream_error' | 'validation_error' | 'network_error';

export interface ChatErrorState {
  kind: ChatErrorKind;
  message: string;
  recoverable: boolean;
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
  pinned?: boolean;
  archived?: boolean;
  provider?: ProviderSnapshot;
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
  capabilities?: ProviderCapabilities;
}

export interface ProviderCapabilities {
  supportsAttachments: boolean;
  supportsImages: boolean;
  maxImageAttachmentBytes: number;
  maxTextFileBytes: number;
  streaming: boolean;
}

export interface ProviderPreset extends ProviderSettings {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastCheckedAt?: number;
  lastCheckStatus?: ProviderReachabilityStatus;
}

export type ProviderReachabilityStatus = 'unchecked' | 'reachable' | 'unreachable';

export interface ProviderSnapshot {
  id?: string;
  name: string;
  baseUrl?: string;
  model?: string;
  capabilities: ProviderCapabilities;
  checkedAt?: number;
  status?: ProviderReachabilityStatus;
}

export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequest {
  messages: ChatRequestMessage[];
  settings?: ProviderSettings;
  locale?: AppLocale;
}

export type AppLocale = 'zh-CN' | 'en';
