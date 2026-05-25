import { getMessage } from '@/i18n';
import { NextRequest, NextResponse } from 'next/server';
import { getProviderConfig, ProviderError, sanitizeProviderMessage } from '@/server/ai/config';
import { AppLocale, ProviderSettings } from '@/types/chat';

export async function POST(request: NextRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  let locale: AppLocale = 'en';

  try {
    const body = (await request.json()) as { settings?: ProviderSettings; locale?: AppLocale };
    locale = body.locale ?? 'en';
    const config = getProviderConfig(body.settings, locale);
    const response = await fetch(`${config.baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ProviderError(await readProviderCheckError(response), response.status);
    }

    return NextResponse.json({
      ok: true,
      model: config.model,
      capabilities: config.capabilities,
    });
  } catch (error: unknown) {
    if (error instanceof ProviderError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    const message = error instanceof DOMException && error.name === 'AbortError'
      ? getMessage(locale, 'provider.checkTimedOut')
      : sanitizeProviderMessage(error instanceof Error ? error.message : getMessage(locale, 'provider.checkFailedGeneric'), locale);

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

async function readProviderCheckError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return sanitizeProviderMessage(body?.error?.message || body?.message);
  } catch {
    return sanitizeProviderMessage(await response.text());
  }
}
