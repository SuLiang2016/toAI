import { NextRequest, NextResponse } from 'next/server';
import { createOpenAICompatibleStream } from '@/server/ai/openai-compatible';
import { ProviderError, sanitizeProviderMessage } from '@/server/ai/config';
import { ChatRequest } from '@/types/chat';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ChatRequest>;

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'Request is missing messages' }, { status: 400 });
    }

    return createOpenAICompatibleStream({
      messages: body.messages,
      settings: body.settings,
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);

    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: sanitizeProviderMessage(error instanceof Error ? error.message : 'Internal server error') },
      { status: 500 }
    );
  }
}
