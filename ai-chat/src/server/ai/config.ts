import { ProviderSettings } from '@/types/chat';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  supportsAttachments: boolean;
}

export class ProviderError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

export function getProviderConfig(settings?: ProviderSettings): ProviderConfig {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new ProviderError('未配置 API Key，请在 .env.local 中设置 AI_API_KEY', 500);
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(settings?.baseUrl || process.env.AI_API_BASE_URL || 'https://api.openai.com/v1'),
    model: settings?.model || process.env.AI_MODEL || 'gpt-3.5-turbo',
    supportsAttachments: settings?.supportsAttachments ?? process.env.AI_SUPPORTS_ATTACHMENTS === 'true',
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');

  if (!trimmed) {
    throw new ProviderError('AI_API_BASE_URL 不能为空', 400);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new ProviderError('AI_API_BASE_URL 不是有效的 HTTP 地址', 400);
  }
}

export function sanitizeProviderMessage(message: unknown): string {
  if (typeof message !== 'string' || !message.trim()) {
    return 'AI 服务请求失败';
  }

  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***');
}
