import { Link } from 'react-router-dom';
import Badge, { StatusBadge } from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import ProcessingSteps from './ProcessingSteps';
import { DOCUMENT_STATUS, IN_PROGRESS } from '../../../constants/app.constants';
import { formatBytes, percent } from '../../../utils/format';
import { issuesOf } from '../case.utils';

export default function DocumentList({ caseId, documents, results, documentTypes, canDelete, onDelete }) {
  return (
    <ul className="divide-y divide-line">
      {documents.map((d) => {
        const issues = issuesOf(results, { documentId: d.id });
        const errors = issues.filter((i) => i.severity === 'error').length;
        const warnings = issues.length - errors;
        const busy = IN_PROGRESS.has(d.status);
        return (
          <li key={d.id} className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-stone-50/70">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 font-mono text-[10px] font-semibold text-stone-600 uppercase">
              {d.mimeType === 'application/pdf' ? 'PDF' : d.mimeType.split('/')[1]}
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`/cases/${caseId}/documents/${d.id}`} className="block truncate font-medium hover:text-brand-700" title={d.originalName}>{d.originalName}</Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                <span>{documentTypes[d.documentType]?.name || (busy ? 'Detecting type…' : 'Unknown type')}</span>
                {d.classificationConfidence != null && <span>{percent(d.classificationConfidence)} sure</span>}
                {d.extractionMethod && <span>{d.extractionMethod === 'ocr' ? `OCR ${d.ocrConfidence ?? ''}%` : 'PDF text'}</span>}
                <span>{formatBytes(d.sizeBytes)}</span>
                {d.versionCount > 1 && <span>v{d.versionCount} (corrected)</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge map={DOCUMENT_STATUS} value={d.status} />
                {errors > 0 && <Badge tone="fail">{errors} error{errors > 1 ? 's' : ''}</Badge>}
                {warnings > 0 && <Badge tone="flag">{warnings} warning{warnings > 1 ? 's' : ''}</Badge>}
                {d.needsManualEntry && <Badge tone="fail">Manual entry</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ProcessingSteps status={d.status} />
              <Link to={`/cases/${caseId}/documents/${d.id}`} className="rounded-md p-1.5 text-stone-500 hover:bg-white hover:text-brand-700" title="Open">
                <Icon name="eye" size={17} />
              </Link>
              {canDelete && (
                <button type="button" onClick={() => onDelete(d)} title="Delete" className="rounded-md p-1.5 text-stone-400 hover:bg-white hover:text-red-600">
                  <Icon name="trash" size={17} />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
