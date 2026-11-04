export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMs(ms) {
  if (ms === null || ms === undefined) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export const percent = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);

export function errorMessage(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;
  if (data?.errors?.length) {
    const details = data.errors.map((e) => (typeof e === 'string' ? e : e.message)).join('; ');
    return `${data.message}: ${details}`;
  }
  return data?.message || err?.message || fallback;
}

export const cx = (...classes) => classes.filter(Boolean).join(' ');
