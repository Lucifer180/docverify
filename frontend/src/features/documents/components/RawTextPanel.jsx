import Loader from '../../../components/common/Loader';
import Alert from '../../../components/common/Alert';
import { useAsync } from '../../../hooks/useAsync';
import { documentService } from '../../../services/document.service';
import { errorMessage } from '../../../utils/format';

/** The raw OCR / PDF text, useful for spotting recognition errors. Viewing it is audited. */
export default function RawTextPanel({ documentId }) {
  const { data, loading, error } = useAsync(() => documentService.rawText(documentId), [documentId]);
  if (loading) return <Loader label="Loading text…" />;
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>;
  return (
    <div>
      <p className="mb-2 text-xs text-stone-500">
        {data.method === 'ocr' ? `Read with OCR (confidence ${data.ocrConfidence ?? '—'}%)` : 'Read from the PDF text layer'}
      </p>
      <pre className="scroll-thin max-h-[420px] overflow-auto rounded-lg bg-stone-50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-800">
        {data.text || '(no text)'}
      </pre>
    </div>
  );
}
