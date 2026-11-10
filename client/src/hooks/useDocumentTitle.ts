import { useEffect } from 'react';

export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · Los Amigos del Kaffe` : 'Los Amigos del Kaffe · Un café a la vez';
  }, [title]);
}
