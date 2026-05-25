import { getMessage } from '@/i18n';
import { NextRequest, NextResponse } from 'next/server';
import { createOpenAICompatibleStream } from '@/server/ai/openai-compatible';
import { ProviderError, sanitizeProviderMessage } from '@/server/ai/config';
import { ChatRequest } from '@/types/chat';

export async function POST(request: NextRequest) {
  let locale: ChatRequest['locale'] = 'en';
  try {
    const body = (await request.json()) as Partial<ChatRequest>;
    locale = body.locale ?? 'en';

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: getMessage(locale, 'api.requestMissingMessages') }, { status: 400 });
    }

    return createOpenAICompatibleStream({
      messages: body.messages,
      settings: body.settings,
      locale,
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);

    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: sanitizeProviderMessage(error instanceof Error ? error.message : getMessage(locale, 'api.internalServerError'), locale) },
      { status: 500 }
    );
  }
}
