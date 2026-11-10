import { CheckCircle2, TriangleAlert, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
}

interface FeedbackApi {
  toast: (message: string, kind?: 'success' | 'error') => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error';
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback requiere FeedbackProvider');
  return value;
}

/** Mensajes de confirmación y diálogo "¿seguro que quieres eliminar?" para toda la aplicación. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback<FeedbackApi['toast']>(
    (message, kind = 'success') => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, kind }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4000);
    },
    [dismiss],
  );

  const confirm = useCallback<FeedbackApi['confirm']>((options) => {
    setPending(options);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setPending(null);
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {pending && (
        <Modal title={pending.title} onClose={() => settle(false)} size="small">
          <p className="confirm__message">{pending.message}</p>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => settle(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn--danger" onClick={() => settle(true)}>
              {pending.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.kind}`}>
            {item.kind === 'success' ? <CheckCircle2 aria-hidden size={18} /> : <TriangleAlert aria-hidden size={18} />}
            <span>{item.message}</span>
            <button type="button" className="toast__close" aria-label="Cerrar mensaje" onClick={() => dismiss(item.id)}>
              <X aria-hidden size={16} />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}
