import { formatDiagnostic } from './chatbox-utils';
import type { AboutInfo, DiagnosticsInfo } from './types';

interface AboutModalProps {
  aboutInfo: AboutInfo | null;
  diagnosticsInfo: DiagnosticsInfo | null;
  logActionStatus: string | null;
  onClose: () => void;
  onExportLogs: () => void;
  onOpenLogs: () => void;
}

export default function AboutModal({
  aboutInfo,
  diagnosticsInfo,
  logActionStatus,
  onClose,
  onExportLogs,
  onOpenLogs,
}: AboutModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">About</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Close" aria-label="Close about" type="button">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-700">
          <div>Version: {aboutInfo?.version ?? 'Unavailable'}</div>
          <div>Platform: {aboutInfo?.platform ?? 'Unavailable'}</div>
          <div>Conversation store: localStorage</div>
          <div className="break-all">Log path: {diagnosticsInfo?.logsPath ?? 'Unavailable'}</div>
          <div>Startup: {formatDiagnostic(diagnosticsInfo?.lastStartupDiagnostic)}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onExportLogs} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200" type="button">
            Export logs
          </button>
          <button onClick={onOpenLogs} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200" type="button">
            Open logs
          </button>
        </div>
        {logActionStatus && <p className="mt-3 break-all text-xs text-gray-500">{logActionStatus}</p>}
      </div>
    </div>
  );
}

