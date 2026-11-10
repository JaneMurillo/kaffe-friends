import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'small' | 'medium';
}

/** Usa <dialog> nativo: atrapa el foco, cierra con Esc y devuelve el foco al salir. */
export function Modal({ title, onClose, children, size = 'medium' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="modal__header">
        <h2 id="modal-title" className="modal__title">
          {title}
        </h2>
        <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
          <X aria-hidden size={20} />
        </button>
      </header>
      <div className="modal__body">{children}</div>
    </dialog>
  );
}
