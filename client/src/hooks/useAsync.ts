import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
  setData: (data: T) => void;
}

/** Carga datos al montar y al cambiar dependencias; descarta respuestas de peticiones viejas. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latestRequest = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    load()
      .then((result) => {
        if (requestId !== latestRequest.current) return;
        setData(result);
        setError(null);
      })
      .catch((reason: Error) => {
        if (requestId === latestRequest.current) setError(reason);
      })
      .finally(() => {
        if (requestId === latestRequest.current) setLoading(false);
      });
    // Las dependencias las define quien llama, igual que en useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}
