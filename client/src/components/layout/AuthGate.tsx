import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { UNAUTHORIZED_EVENT, api } from '../../services/api';
import { Field } from '../ui/Field';
import { LogoMark } from '../ui/Illustrations';
import { PageLoader } from '../ui/States';

type Status = 'loading' | 'open' | 'locked';

/** Si el servidor tiene contraseña, nada de la guía se muestra hasta iniciar sesión. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  const check = useCallback(async () => {
    try {
      const result = await api.authStatus();
      setStatus(result.required && !result.authenticated ? 'locked' : 'open');
    } catch {
      // Sin conexión, las propias vistas muestran el error con la opción de reintentar.
      setStatus('open');
    }
  }, []);

  useEffect(() => {
    void check();
    const lock = () => setStatus('locked');
    window.addEventListener(UNAUTHORIZED_EVENT, lock);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, lock);
  }, [check]);

  if (status === 'loading') return <PageLoader />;
  if (status === 'locked') return <LoginScreen onSuccess={() => setStatus('open')} />;
  return <>{children}</>;
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (reason) {
      setError((reason as Error).message);
      setSending(false);
    }
  };

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit}>
        <LogoMark className="login__mark" />
        <h1 className="login__title">Los Amigos del Kaffe</h1>
        <p className="login__text">Esta guía es privada.</p>
        <Field label="Contraseña" error={error}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <button type="submit" className="btn btn--primary" disabled={sending || !password}>
          {sending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
