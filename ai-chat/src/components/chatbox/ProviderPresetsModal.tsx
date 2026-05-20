import type { ProviderPreset } from '@/types/chat';
import type { ProviderPresetFormDraft } from './types';

interface ProviderPresetsModalProps {
  activeProviderPreset: ProviderPreset | null;
  activeProviderPresetId: string | null;
  providerPresets: ProviderPreset[];
  presetDraft: ProviderPresetFormDraft;
  providerError: string | null;
  providerCheckState: string | null;
  providerCheckInFlight: boolean;
  onClose: () => void;
  onCheckProviderPreset: () => void;
  onActivateProviderPreset: (presetId: string) => void;
  onOpenEditProviderPreset: (preset: ProviderPreset) => void;
  onDeleteProviderPreset: (presetId: string) => void;
  onPresetDraftChange: (nextDraft: ProviderPresetFormDraft) => void;
  onResetPresetDraft: () => void;
  onSaveProviderPreset: () => void;
}

export default function ProviderPresetsModal({
  activeProviderPreset,
  activeProviderPresetId,
  providerPresets,
  presetDraft,
  providerError,
  providerCheckState,
  providerCheckInFlight,
  onClose,
  onCheckProviderPreset,
  onActivateProviderPreset,
  onOpenEditProviderPreset,
  onDeleteProviderPreset,
  onPresetDraftChange,
  onResetPresetDraft,
  onSaveProviderPreset,
}: ProviderPresetsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Provider presets</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Close" aria-label="Close settings" type="button">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 rounded-md border border-gray-200 p-3 text-sm text-gray-700">
          Active: {activeProviderPreset ? activeProviderPreset.name : 'Environment defaults'}
          <div className="mt-1 text-xs text-gray-500">
            Attachments: {activeProviderPreset ? (activeProviderPreset.supportsAttachments ? 'enabled by active preset' : 'disabled by active preset') : 'controlled by environment defaults'}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={onCheckProviderPreset} className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50" disabled={providerCheckInFlight} type="button">
              {providerCheckInFlight ? 'Checking...' : 'Check connectivity'}
            </button>
            {providerCheckState && <span className="text-xs text-gray-600">{providerCheckState}</span>}
          </div>
        </div>

        <div className="mb-4 grid gap-2">
          {providerPresets.map(preset => (
            <div key={preset.id} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 p-3">
              <button
                onClick={() => onActivateProviderPreset(preset.id)}
                className={`rounded px-2 py-1 text-xs ${
                  preset.id === activeProviderPresetId ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
                type="button"
              >
                {preset.id === activeProviderPresetId ? 'Active' : 'Activate'}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">{preset.name}</div>
                <div className="truncate text-xs text-gray-500">
                  {preset.model || 'env model'} at {preset.baseUrl || 'env base URL'}
                </div>
              </div>
              <button onClick={() => onOpenEditProviderPreset(preset)} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" type="button">
                Edit
              </button>
              <button onClick={() => onDeleteProviderPreset(preset.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" type="button">
                Delete
              </button>
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-md border border-gray-200 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{presetDraft.id ? 'Edit preset' : 'New preset'}</h3>
            <button onClick={onResetPresetDraft} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50" type="button">
              Clear
            </button>
          </div>

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Name</span>
            <input
              value={presetDraft.name}
              onChange={event => onPresetDraftChange({ ...presetDraft, name: event.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">API Base URL</span>
            <input
              value={presetDraft.baseUrl}
              onChange={event => onPresetDraftChange({ ...presetDraft, baseUrl: event.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Model name</span>
            <input
              value={presetDraft.model}
              onChange={event => onPresetDraftChange({ ...presetDraft, model: event.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={presetDraft.supportsAttachments}
              onChange={event => onPresetDraftChange({ ...presetDraft, supportsAttachments: event.target.checked })}
            />
            Enable image attachment passthrough
          </label>

          {providerError && <p className="text-sm text-red-600">{providerError}</p>}
        </div>

        <p className="mb-4 text-xs text-gray-500">
          API keys still come from `.env.local`; presets store only provider URL, model, and capability hints.
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100" type="button">
            Cancel
          </button>
          <button onClick={onSaveProviderPreset} className="rounded-md bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600" type="button">
            Save preset
          </button>
        </div>
      </div>
    </div>
  );
}

