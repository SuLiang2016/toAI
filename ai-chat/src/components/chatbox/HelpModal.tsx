import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslate } from '@/i18n';

interface HelpModalProps {
  title: string;
  markdown: string;
  onClose: () => void;
}

export default function HelpModal({ title, markdown, onClose }: HelpModalProps) {
  const t = useTranslate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            title={t('help.close')}
            aria-label={t('help.close')}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[calc(88vh-4.5rem)] overflow-y-auto px-5 py-4">
          <div className="markdown-body prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
