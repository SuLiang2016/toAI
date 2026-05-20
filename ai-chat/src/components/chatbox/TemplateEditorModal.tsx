import type { TemplateFormDraft } from './types';

interface TemplateEditorModalProps {
  templateDraft: TemplateFormDraft;
  onClose: () => void;
  onTemplateDraftChange: (nextDraft: TemplateFormDraft) => void;
  onSaveTemplate: () => void;
}

export default function TemplateEditorModal({
  templateDraft,
  onClose,
  onTemplateDraftChange,
  onSaveTemplate,
}: TemplateEditorModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{templateDraft.id ? 'Edit template' : 'New template'}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Close" aria-label="Close template editor" type="button">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
          <input
            value={templateDraft.title}
            onChange={event => onTemplateDraftChange({ ...templateDraft, title: event.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Content</span>
          <textarea
            value={templateDraft.content}
            onChange={event => onTemplateDraftChange({ ...templateDraft, content: event.target.value })}
            className="min-h-36 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" type="button">
            Cancel
          </button>
          <button onClick={onSaveTemplate} disabled={!templateDraft.content.trim()} className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50" type="button">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

