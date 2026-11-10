import type { ReactNode } from 'react';
import { CupIllustration } from './Illustrations';

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <CupIllustration className="empty__art" />
      <h3 className="empty__title">{title}</h3>
      <p className="empty__message">{message}</p>
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="empty empty--error" role="alert">
      <h3 className="empty__title">Se nos cayó la taza</h3>
      <p className="empty__message">{error.message}</p>
      {onRetry && (
        <div className="empty__action">
          <button type="button" className="btn btn--ghost" onClick={onRetry}>
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="card-grid" role="status" aria-label="Cargando">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton-card">
          <div className="skeleton skeleton--image" />
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--line" />
        </div>
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <CupIllustration className="page-loader__art" />
      <span>Preparando tu café…</span>
    </div>
  );
}
