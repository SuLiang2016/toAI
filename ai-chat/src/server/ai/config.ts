import { normalizeProviderCapabilities, normalizeProviderSettings, validateProviderSettings } from '@/lib/storage';
import { ProviderCapabilities, ProviderSettings } from '@/types/chat';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  supportsAttachments: boolean;
  capabilities: ProviderCapabilities;
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
    throw new ProviderError('Missing API key. Set AI_API_KEY in .env.local.', 500);
  }

  const validated = validateProviderSettings(settings);
  if (!validated.ok) {
    throw new ProviderError(validated.message || 'Provider settings are invalid.', 400);
  }

  const normalized = normalizeProviderSettings(validated.settings);
  const normalizedCapabilities = normalizeProviderCapabilities(normalized);
  const envSupportsAttachments = process.env.AI_SUPPORTS_ATTACHMENTS === 'true';
  const supportsAttachments = normalized.supportsAttachments ?? envSupportsAttachments;

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(normalized.baseUrl || process.env.AI_API_BASE_URL || 'https://api.openai.com/v1'),
    model: normalized.model || process.env.AI_MODEL || 'gpt-3.5-turbo',
    supportsAttachments,
    capabilities: {
      ...normalizedCapabilities,
      supportsAttachments,
      supportsImages: normalizedCapabilities.supportsImages ?? supportsAttachments,
    },
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');

  if (!trimmed) {
    throw new ProviderError('AI_API_BASE_URL cannot be empty', 400);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new ProviderError('AI_API_BASE_URL must be a valid HTTP URL', 400);
  }
}

export function sanitizeProviderMessage(message: unknown): string {
  if (typeof message !== 'string' || !message.trim()) {
    return 'AI service request failed';
  }

  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
    .replace(/(["']?(?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?)[^"',}\s]+(["']?)/gi, '$1***$2')
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, '[local path]')
    .replace(/\/(?:Users|home|var|tmp|etc)\/[^\s"'<>]+/g, '[local path]');
}
