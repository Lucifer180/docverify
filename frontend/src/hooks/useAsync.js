import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader and tracks data / loading / error.
 * reload() re-runs it; options.poll keeps re-running while poll(data) returns true.
 */
export function useAsync(loader, deps = [], { poll, interval = 2500, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const mounted = useRef(true);

  const run = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await loaderRef.current();
      if (mounted.current) { setData(result); setError(null); }
      return result;
    } catch (err) {
      if (mounted.current) setError(err);
      return null;
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (enabled) run();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  const shouldPoll = Boolean(poll && data && poll(data));
  useEffect(() => {
    if (!shouldPoll) return undefined;
    const t = setInterval(() => run({ silent: true }), interval);
    return () => clearInterval(t);
  }, [shouldPoll, interval, run]);

  return { data, setData, error, loading, reload: run };
}
