import { Archive, Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { useFeedback } from '../components/ui/Feedback';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../services/api';
import type { BackupInfo } from '../types';
import { formatBytes, formatDateTime } from '../utils/format';

const RESTORE_MESSAGE =
  'Tus datos y fotografías actuales se reemplazarán por los del respaldo. Antes se guardará automáticamente una copia de seguridad del estado actual.';

export function BackupsPage() {
  useDocumentTitle('Respaldos');
  const { toast, confirm } = useFeedback();
  const { data: backups, error, reload } = useAsync(() => api.backups(), []);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success: string, reloadPage = false) => {
    setBusy(true);
    try {
      await action();
      toast(success);
      reload();
      // Tras restaurar, todo lo que había en pantalla pertenece a los datos anteriores.
      if (reloadPage) window.setTimeout(() => window.location.assign('/'), 900);
    } catch (reason) {
      toast((reason as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (backup: BackupInfo) => {
    const accepted = await confirm({
      title: 'Restaurar este respaldo',
      message: RESTORE_MESSAGE,
      confirmLabel: 'Restaurar',
    });
    if (accepted) await run(() => api.restoreBackup(backup.name), 'Respaldo restaurado.', true);
  };

  const restoreFile = async (file: File) => {
    const accepted = await confirm({
      title: `Restaurar ${file.name}`,
      message: RESTORE_MESSAGE,
      confirmLabel: 'Restaurar',
    });
    if (accepted) await run(() => api.restoreFromFile(file), 'Respaldo restaurado.', true);
  };

  const remove = async (backup: BackupInfo) => {
    const accepted = await confirm({
      title: 'Eliminar respaldo',
      message: `Se borrará ${backup.name} de tu computadora. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar respaldo',
    });
    if (accepted) await run(() => api.deleteBackup(backup.name), 'Respaldo eliminado.');
  };

  return (
    <>
      <PageHeader
        kicker="Tus datos"
        title="Respaldos y restauración"
        intro="Un respaldo es un archivo ZIP con la base de datos completa (lugares, calificaciones y opiniones) y todas tus fotografías. Guarda una copia fuera de esta computadora de vez en cuando."
      >
        <div className="backup-actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => run(api.createBackup, 'Respaldo creado.')}>
            <Archive aria-hidden size={18} /> {busy ? 'Trabajando…' : 'Crear respaldo'}
          </button>
          <label className={`btn btn--ghost ${busy ? 'is-disabled' : ''}`}>
            <Upload aria-hidden size={18} /> Restaurar desde un archivo
            <input
              type="file"
              accept=".zip,application/zip"
              className="visually-hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void restoreFile(file);
              }}
            />
          </label>
        </div>
      </PageHeader>

      <section className="container section--flush">
        {error && <ErrorState error={error} onRetry={reload} />}
        {!error && !backups && <PageLoader />}
        {backups?.length === 0 && (
          <EmptyState title="Aún no hay respaldos" message="Crea el primero: solo toma un momento." />
        )}
        {backups && backups.length > 0 && (
          <ul className="backup-list">
            {backups.map((backup) => (
              <li key={backup.name} className="backup-item">
                <div className="backup-item__main">
                  <p className="backup-item__name">{backup.name}</p>
                  <p className="backup-item__meta">
                    {formatDateTime(backup.createdAt)} · {formatBytes(backup.sizeBytes)}
                  </p>
                </div>
                <div className="backup-item__actions">
                  <a className="btn btn--small btn--ghost" href={api.backupDownloadUrl(backup.name)} download>
                    <Download aria-hidden size={16} /> Descargar
                  </a>
                  <button type="button" className="btn btn--small btn--ghost" disabled={busy} onClick={() => restore(backup)}>
                    <RotateCcw aria-hidden size={16} /> Restaurar
                  </button>
                  <button type="button" className="icon-btn" disabled={busy} aria-label={`Eliminar ${backup.name}`} onClick={() => remove(backup)}>
                    <Trash2 aria-hidden size={17} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
