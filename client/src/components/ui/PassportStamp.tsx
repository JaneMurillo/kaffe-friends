import { useId } from 'react';
import type { VisitStatus } from '../../types';

/** Sello del Pasaporte Guadalajara: entintado si ya se visitó, punteado si está pendiente. */
export function PassportStamp({ status, className = '' }: { status: VisitStatus; className?: string }) {
  const pathId = useId();
  const visited = status === 'visitado';
  return (
    <svg
      viewBox="0 0 100 100"
      className={`stamp stamp--${status} ${className}`}
      role="img"
      aria-label={`Pasaporte Guadalajara: ${visited ? 'visitado' : 'pendiente'}`}
    >
      <defs>
        <path id={pathId} d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0" />
      </defs>
      <circle cx="50" cy="50" r="46" className="stamp__outer" />
      <circle cx="50" cy="50" r="28" className="stamp__inner" />
      <text className="stamp__arc">
        <textPath href={`#${pathId}`} startOffset="0" textLength="222">
          PASAPORTE · GUADALAJARA ·
        </textPath>
      </text>
      <text x="50" y="55" textAnchor="middle" className="stamp__label">
        {visited ? 'VISITADO' : 'PENDIENTE'}
      </text>
    </svg>
  );
}
