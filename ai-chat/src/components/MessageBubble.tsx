'use client';

/* eslint-disable @next/next/no-img-element */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCurrentLocale, useTranslate } from '@/i18n';
import { Message } from '@/types/chat';

type TranslateFn = ReturnType<typeof useTranslate>;

interface MessageBubbleProps {
  message: Message;
  canRegenerate: boolean;
  onCopyMessage: (message: Message) => void;
  onCopyCode: (code: string) => void;
  onRegenerate: () => void;
  onEditResend: (message: Message) => void;
}

export default function MessageBubble({
  message,
  canRegenerate,
  onCopyMessage,
  onCopyCode,
  onRegenerate,
  onEditResend,
}: MessageBubbleProps) {
  const t = useTranslate();
  const { locale } = useCurrentLocale();
  const isUser = message.role === 'user';

  return (
    <div className={`group mb-4 flex animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[min(76%,calc(100vw-2rem))] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`w-full overflow-hidden rounded-2xl px-4 py-2 ${
            isUser
              ? 'rounded-br-md bg-blue-500 text-white'
              : 'rounded-bl-md bg-gray-100 text-gray-900'
          }`}
        >
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {message.attachments.map(attachment => (
                <div key={attachment.id} className="relative">
                  {attachment.type === 'image' ? (
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="max-h-48 cursor-pointer rounded-lg object-contain transition-opacity hover:opacity-90"
                      onClick={() => window.open(attachment.url, '_blank')}
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="max-w-[200px] truncate text-sm">{attachment.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="markdown-body prose prose-sm max-w-none overflow-hidden dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => {
                    const code = extractText(children);
                    return (
                      <div className="group/code relative">
                        <button
                          onClick={() => onCopyCode(code)}
                          className="absolute right-2 top-2 rounded bg-gray-900/80 px-2 py-1 text-xs text-white opacity-0 transition group-hover/code:opacity-100"
                          type="button"
                        >
                          {t('common.copy')}
                        </button>
                        <pre>{children}</pre>
                      </div>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          <div className={`mt-2 text-xs ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
            {new Date(message.timestamp).toLocaleTimeString(locale)}
            {message.status && message.status !== 'complete' && (
              <span className="ml-2 uppercase tracking-wide">{translateMessageStatus(message.status, t)}</span>
            )}
          </div>
        </div>

        <div
          className={`flex max-w-full flex-wrap gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 ${
            isUser ? 'justify-end' : 'justify-start'
          }`}
        >
          <button
            onClick={() => onCopyMessage(message)}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            type="button"
          >
            {t('common.copy')}
          </button>
          {isUser ? (
            <button
              onClick={() => onEditResend(message)}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              type="button"
            >
              {t('message.edit')}
            </button>
          ) : (
            canRegenerate && (
              <button
                onClick={onRegenerate}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                type="button"
              >
                {t('message.regenerate')}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function translateMessageStatus(
  status: NonNullable<Message['status']>,
  t: TranslateFn
) {
  switch (status) {
    case 'streaming':
      return t('message.status.streaming');
    case 'partial':
      return t('message.status.partial');
    case 'aborted':
      return t('message.status.aborted');
    case 'error':
      return t('message.status.error');
    default:
      return status;
  }
}

function extractText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isReactNodeWithChildren(node)) return extractText(node.props.children);
  return '';
}

function isReactNodeWithChildren(node: unknown): node is { props: { children?: unknown } } {
  return Boolean(
    node &&
    typeof node === 'object' &&
    'props' in node &&
    typeof (node as { props?: unknown }).props === 'object'
  );
}
