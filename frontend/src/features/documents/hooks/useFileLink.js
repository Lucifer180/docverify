import { useCallback, useEffect, useState } from 'react';
import { documentService } from '../../../services/document.service';
import { fileUrl } from '../../../services/case.service';

const REFRESH_MS = 4 * 60 * 1000; // links expire after 5 minutes

/** Gets a short-lived signed link to the original file and refreshes it before it expires. */
export function useFileLink(documentId) {
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await documentService.fileLink(documentId);
      setLink({ ...data, url: fileUrl(data.url) });
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [documentId]);

  useEffect(() => {
    setLink(null);
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  return { link, error, refresh: load };
}
