import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/common/Button';
import Badge, { StatusBadge } from '../components/common/Badge';
import Icon from '../components/common/Icon';
import Alert from '../components/common/Alert';
import Card from '../components/common/Card';
import { PageLoader } from '../components/common/Loader';
import DocumentViewer from '../features/documents/components/DocumentViewer';
import FieldEditor from '../features/documents/components/FieldEditor';
import VersionHistory from '../features/documents/components/VersionHistory';
import RawTextPanel from '../features/documents/components/RawTextPanel';
import IssueList from '../features/cases/components/IssueList';
import ProcessingSteps from '../features/cases/components/ProcessingSteps';
import { useCaseDetail } from '../features/cases/hooks/useCaseDetail';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { documentService } from '../services/document.service';
import { documentTypeService } from '../services/admin.service';
import { DOCUMENT_STATUS, IN_PROGRESS } from '../constants/app.constants';
import { cx, errorMessage, formatMs, percent } from '../utils/format';

const TABS = [['fields', 'Extracted fields'], ['checks', 'Checks'], ['versions', 'Versions'], ['text', 'Raw text']];

export default function DocumentReview() {
  const { caseId, documentId } = useParams();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const toast = useToast();
  const staff = hasRole('reviewer', 'admin');
  const { data, loading, error, reload, reveal, setReveal } = useCaseDetail(caseId);
  const { data: allTypes } = useAsync(() => documentTypeService.list(), [], { enabled: staff });
  const [tab, setTab] = useState('fields');
  const [versionKey, setVersionKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const doc = data?.documents.find((d) => d.id === documentId);
  const docResults = useMemo(() => (data ? data.results.filter((r) => r.documentId === documentId
    || r.details?.documentIds?.includes(documentId)) : []), [data, documentId]);
  const issuesByField = useMemo(() => {
    const map = {};
    for (const r of docResults) {
      if (r.passed || r.severity === 'info' || !r.field) continue;
      // Cross-document results use a generic key (person_name); map them onto this document's field.
      let key = r.field;
      if (r.scope === 'case' && doc) {
        const typeDef = data.documentTypes[doc.documentType];
        key = typeDef?.fields.find((f) => f.compareAs === r.field)?.key || key;
      }
      (map[key] ||= []).push(r);
    }
    return map;
  }, [docResults, doc, data]);

  if (loading && !data) return <PageLoader />;
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>;
  if (!doc) return <Alert tone="error" title="Document not found">It may have been deleted. <Link className="underline" to={`/cases/${caseId}`}>Back to the case</Link></Alert>;

  const c = data.case;
  const typeDef = data.documentTypes[doc.documentType];
  const editable = staff && c.status === 'submitted' && !IN_PROGRESS.has(doc.status);
  const index = data.documents.findIndex((d) => d.id === doc.id);
  const prev = data.documents[index - 1];
  const next = data.documents[index + 1];
  const busyProcessing = IN_PROGRESS.has(doc.status);
  const failedChecks = docResults.filter((r) => !r.passed && r.severity !== 'info');

  const save = async (payload) => {
    try {
      await documentService.correct(doc.id, payload);
      toast.success('Corrections saved as a new version. Checks updated.');
      setVersionKey((k) => k + 1);
      await reload({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  const reprocess = async (fromScratch) => {
    setBusy(true);
    try {
      await documentService.reprocess(doc.id, fromScratch);
      toast.info(fromScratch ? 'Running OCR and extraction again…' : 'Running AI extraction again…');
      await reload({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/cases/${caseId}`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700">
          <Icon name="arrowLeft" size={15} /> <span className="font-mono">{c.reference}</span>
        </Link>
        <span className="text-stone-300">/</span>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{doc.originalName}</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={!prev} onClick={() => navigate(`/cases/${caseId}/documents/${prev.id}`)}>← Prev</Button>
          <span className="font-mono text-xs text-stone-500">{index + 1}/{data.documents.length}</span>
          <Button variant="secondary" size="sm" disabled={!next} onClick={() => navigate(`/cases/${caseId}/documents/${next.id}`)}>Next →</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs text-stone-600">
        <StatusBadge map={DOCUMENT_STATUS} value={doc.status} />
        <ProcessingSteps status={doc.status} />
        <span><b className="text-ink-800">{typeDef?.name || 'Type pending'}</b>{doc.classificationConfidence != null && ` · ${percent(doc.classificationConfidence)} confidence`}</span>
        {doc.extractionMethod && <span>{doc.extractionMethod === 'ocr' ? `OCR · ${doc.ocrConfidence ?? '—'}% confidence` : 'PDF text layer'}{doc.pageCount ? ` · ${doc.pageCount} page(s)` : ''}</span>}
        {doc.llmModel && <span className="font-mono">{doc.llmModel}</span>}
        {doc.timings?.totalMs && <span>Processed in {formatMs(doc.timings.totalMs)}</span>}
        <div className="ml-auto flex items-center gap-2">
          {staff && (
            <Button variant="ghost" size="sm" icon={<Icon name={reveal ? 'eyeOff' : 'eye'} size={15} />} onClick={() => setReveal((r) => !r)}>
              {reveal ? 'Hide sensitive' : 'Reveal sensitive'}
            </Button>
          )}
          {(staff || c.submitterId === user.id) && !busyProcessing && c.status !== 'approved' && c.status !== 'rejected' && (
            <Button variant="ghost" size="sm" icon={<Icon name="refresh" size={15} />} loading={busy} onClick={() => reprocess(false)}>Re-extract</Button>
          )}
        </div>
      </div>

      {doc.status === 'processing_failed' && (
        <Alert tone="error" title="Processing failed" action={<Button size="sm" variant="secondary" loading={busy} onClick={() => reprocess(true)}>Try again</Button>}>
          {doc.errorMessage}
        </Alert>
      )}
      {doc.needsManualEntry && (
        <Alert tone="warning" title="Manual entry needed">
          The fields could not be extracted automatically{doc.ocrConfidence !== null && doc.ocrConfidence < 60 ? ' (the image quality is low)' : ''}.
          {editable ? ' Type the values from the original document and save.' : ' A reviewer will enter them.'}
        </Alert>
      )}
      {busyProcessing && <Alert tone="info">This document is still being processed. The page updates automatically.</Alert>}

      {/* Side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
          <DocumentViewer document={doc} />
        </div>

        <Card bodyClassName="p-0" className="min-w-0">
          <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2" role="tablist">
            {TABS.filter(([k]) => k !== 'text' || staff).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={cx('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition',
                  tab === key ? 'border-brand-700 font-medium text-brand-800' : 'border-transparent text-stone-500 hover:text-ink-900')}>
                {label}
                {key === 'checks' && failedChecks.length > 0 && <Badge tone={failedChecks.some((r) => r.severity === 'error') ? 'fail' : 'flag'}>{failedChecks.length}</Badge>}
              </button>
            ))}
          </div>
          <div className={cx(tab === 'checks' ? 'p-0' : 'p-5')}>
            {tab === 'fields' && (
              busyProcessing && !doc.fields ? <p className="text-sm text-stone-500">Fields will appear here once extraction finishes.</p> : (
                <>
                  {!editable && staff && c.status !== 'submitted' && (
                    <p className="mb-3 text-xs text-stone-500">Corrections are possible while the case is submitted for review.</p>
                  )}
                  <FieldEditor typeDef={typeDef} allTypes={allTypes} documentType={doc.documentType} data={doc.fields?.data}
                    issuesByField={issuesByField} editable={editable} sensitiveRevealed={data.sensitiveRevealed} onSave={save} />
                </>
              )
            )}
            {tab === 'checks' && <IssueList results={docResults} documents={data.documents} caseId={caseId} />}
            {tab === 'versions' && <VersionHistory documentId={doc.id} reveal={reveal} refreshKey={`${versionKey}-${doc.versionCount}`} />}
            {tab === 'text' && staff && <RawTextPanel documentId={doc.id} />}
          </div>
        </Card>
      </div>
    </div>
  );
}
