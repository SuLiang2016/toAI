import { useTranslate } from '@/i18n';
import { formatDiagnostic } from './chatbox-utils';
import type { AboutInfo, DiagnosticsInfo } from './types';

interface AboutModalProps {
  aboutInfo: AboutInfo | null;
  diagnosticsInfo: DiagnosticsInfo | null;
  logActionStatus: string | null;
  backupActionStatus: string | null;
  storageHealthSummary: string | null;
  recoveryHint: string | null;
  onClose: () => void;
  onExportBackup: () => void;
  onRestoreBackup: () => void;
  onExportLogs: () => void;
  onOpenLogs: () => void;
}

export default function AboutModal({
  aboutInfo,
  diagnosticsInfo,
  logActionStatus,
  backupActionStatus,
  storageHealthSummary,
  recoveryHint,
  onClose,
  onExportBackup,
  onRestoreBackup,
  onExportLogs,
  onOpenLogs,
}: AboutModalProps) {
  const t = useTranslate();
  const unavailableLabel = t('common.unavailable');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t('about.title')}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" title={t('common.close')} aria-label={t('about.close')} type="button">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-700">
          <div>{t('about.version', { value: aboutInfo?.version ?? unavailableLabel })}</div>
          <div>{t('about.platform', { value: aboutInfo?.platform ?? unavailableLabel })}</div>
          <div>{t('about.conversationStore')}</div>
          <div>{t('about.storageStrategy')}</div>
          <div>{t('about.backupRestoreMode')}</div>
          <div className="break-all">{t('about.logPath', { value: diagnosticsInfo?.logsPath ?? unavailableLabel })}</div>
          <div>{t('about.startup', { value: formatDiagnostic(diagnosticsInfo?.lastStartupDiagnostic, unavailableLabel, t('common.available')) })}</div>
        </div>
        {storageHealthSummary && (
          <p className="mt-3 break-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {storageHealthSummary}
          </p>
        )}
        {recoveryHint && (
          <p className="mt-3 break-all rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {recoveryHint}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onExportBackup} className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100" type="button">
            {t('about.exportBackup')}
          </button>
          <button onClick={onRestoreBackup} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100" type="button">
            {t('about.restoreBackup')}
          </button>
          <button onClick={onExportLogs} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200" type="button">
            {t('about.exportLogs')}
          </button>
          <button onClick={onOpenLogs} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200" type="button">
            {t('about.openLogs')}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">{t('about.restoreWarning')}</p>
        {backupActionStatus && <p className="mt-3 break-all text-xs text-gray-500">{backupActionStatus}</p>}
        {logActionStatus && <p className="mt-3 break-all text-xs text-gray-500">{logActionStatus}</p>}
      </div>
    </div>
  );
}
