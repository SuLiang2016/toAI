import { ChatRequest, ChatRequestMessage } from '@/types/chat';
import { getProviderConfig, ProviderError, sanitizeProviderMessage } from './config';

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAIMessage {
  role: ChatRequestMessage['role'];
  content: string | OpenAIContentPart[];
}

export async function createOpenAICompatibleStream(request: ChatRequest): Promise<Response> {
  const config = getProviderConfig(request.settings);
  const upstream = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: mapMessages(request.messages, config.supportsAttachments),
      stream: true,
    }),
  });

  if (!upstream.ok) {
    throw new ProviderError(await readUpstreamError(upstream), upstream.status);
  }

  if (!upstream.body) {
    throw new ProviderError('AI service returned an empty response stream', 502);
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function mapMessages(messages: ChatRequestMessage[], supportsAttachments: boolean): OpenAIMessage[] {
  return messages.map(message => {
    if (!message.attachments?.length) {
      return {
        role: message.role,
        content: message.content,
      };
    }

    if (!supportsAttachments) {
      throw new ProviderError('The active model does not support attachments. Remove attachments or enable an attachment-capable preset.', 400);
    }

    const content: OpenAIContentPart[] = [];
    if (message.content) {
      content.push({ type: 'text', text: message.content });
    }

    for (const attachment of message.attachments) {
      if (attachment.type !== 'image' || !attachment.data) {
        throw new ProviderError('This attachment flow only supports direct image uploads. Convert other files to text first.', 400);
      }

      content.push({
        type: 'image_url',
        image_url: { url: attachment.data },
      });
    }

    return {
      role: message.role,
      content,
    };
  });
}

async function readUpstreamError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return sanitizeProviderMessage(body?.error?.message || body?.message);
  } catch {
    return sanitizeProviderMessage(await response.text());
  }
}
