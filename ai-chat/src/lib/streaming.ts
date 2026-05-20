export interface StreamEvent {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

export class StreamingParseError extends Error {
  constructor(message = 'AI service returned invalid streaming data') {
    super(message);
    this.name = 'StreamingParseError';
  }
}

export function consumeSseBuffer(buffer: string): { events: StreamEvent[]; remainder: string; done: boolean } {
  const lines = buffer.split(/\r?\n/);
  const remainder = lines.pop() || '';
  const events: StreamEvent[] = [];
  let done = false;

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;

    const data = line.slice(6).trim();
    if (!data) continue;
    if (data === '[DONE]') {
      done = true;
      continue;
    }

    try {
      events.push(JSON.parse(data) as StreamEvent);
    } catch {
      throw new StreamingParseError();
    }
  }

  return { events, remainder, done };
}

export function readStreamEventContent(events: StreamEvent[]): string {
  return events
    .map(event => event.choices?.[0]?.delta?.content ?? '')
    .filter(Boolean)
    .join('');
}
