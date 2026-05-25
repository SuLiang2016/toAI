import { useTranslate } from '@/i18n';

interface RenameConversationModalProps {
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function RenameConversationModal({
  renameDraft,
  onRenameDraftChange,
  onClose,
  onSave,
}: RenameConversationModalProps) {
  const t = useTranslate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-gray-900">{t('rename.title')}</h2>
        <input
          value={renameDraft}
          onChange={event => onRenameDraftChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSave();
            }
            if (event.key === 'Escape') {
              onClose();
            }
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" type="button">
            {t('common.cancel')}
          </button>
          <button onClick={onSave} className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600" type="button">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
