import Modal from '../../../components/common/Modal';
import Loader from '../../../components/common/Loader';
import { caseService } from '../../../services/case.service';
import { useAsync } from '../../../hooks/useAsync';
import { formatDateTime } from '../../../utils/formatDate';

const ACTION_LABELS = {
  'case.created': 'Case created', 'case.updated': 'Case details updated', 'case.submitted': 'Submitted for review',
  'case.assigned': 'Reviewer assigned', 'case.decision': 'Decision recorded', 'case.report_exported': 'Report exported',
  'document.uploaded': 'Document uploaded', 'document.deleted': 'Document deleted', 'document.reprocess_requested': 'Reprocessing requested',
  'document.file_viewed': 'Original file viewed', 'processing.text_extracted': 'Text extracted',
  'processing.fields_extracted': 'Fields extracted by AI', 'processing.validated': 'Automated checks completed',
  'processing.failed': 'Processing failed', 'fields.corrected': 'Fields corrected', 'fields.sensitive_revealed': 'Sensitive values viewed',
};

function describe(entry) {
  const d = entry.details || {};
  if (entry.action === 'case.decision') return `${d.decision?.replace('_', ' ')}${d.comment ? ` — “${d.comment}”` : ''}`;
  if (entry.action === 'document.uploaded') return d.name;
  if (entry.action === 'processing.text_extracted') return `${d.method === 'ocr' ? 'OCR' : 'PDF text layer'}, ${d.pages} page(s)${d.ocrConfidence ? `, ${d.ocrConfidence}% confidence` : ''}`;
  if (entry.action === 'processing.fields_extracted') return `${d.documentType} (${Math.round((d.confidence || 0) * 100)}%) via ${d.model || '—'}${d.needsManualEntry ? ' — manual entry needed' : ''}`;
  if (entry.action === 'processing.validated') return `${d.preliminaryStatus}: ${d.issues} issue(s) in ${d.checks} checks`;
  if (entry.action === 'fields.corrected') return `v${d.version}: ${(d.changes || []).map((c) => c.field).join(', ')}${d.note ? ` — “${d.note}”` : ''}`;
  if (entry.action === 'processing.failed') return d.error;
  return '';
}

export default function CaseHistory({ caseId, open, onClose }) {
  const { data, loading } = useAsync(() => caseService.history(caseId), [caseId, open], { enabled: open });
  return (
    <Modal open={open} onClose={onClose} title="Audit history" description="Every upload, processing step, correction and decision" size="lg">
      {loading || !data ? <Loader label="Loading history…" /> : (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {data.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-200" />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{ACTION_LABELS[e.action] || e.action}</span>
                <span className="font-mono text-xs text-stone-500">{formatDateTime(e.createdAt)}</span>
              </div>
              <div className="text-xs text-stone-500">{e.userEmail || 'system'}{describe(e) ? ` · ${describe(e)}` : ''}</div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
