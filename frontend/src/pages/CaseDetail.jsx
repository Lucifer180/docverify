import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge, { StatusBadge } from '../components/common/Badge';
import Icon from '../components/common/Icon';
import Modal from '../components/common/Modal';
import Alert from '../components/common/Alert';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/Loader';
import UploadDropzone from '../features/cases/components/UploadDropzone';
import DocumentList from '../features/cases/components/DocumentList';
import IssueList from '../features/cases/components/IssueList';
import DecisionPanel from '../features/cases/components/DecisionPanel';
import CaseHistory from '../features/cases/components/CaseHistory';
import CaseForm from '../features/cases/components/CaseForm';
import { useCaseDetail } from '../features/cases/hooks/useCaseDetail';
import { isEditableBySubmitter, isProcessing } from '../features/cases/case.utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { caseService } from '../services/case.service';
import { documentService } from '../services/document.service';
import { CASE_STATUS, DECISIONS, PRELIMINARY_STATUS } from '../constants/app.constants';
import { formatDate, formatDateTime } from '../utils/formatDate';
import { errorMessage } from '../utils/format';

export default function CaseDetail() {
  const { caseId } = useParams();
  const { user, hasRole } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useCaseDetail(caseId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState('');

  if (loading && !data) return <PageLoader />;
  if (error) {
    return <Alert tone="error" title="Could not open this case">{errorMessage(error)} <Link to="/cases" className="underline">Back to cases</Link></Alert>;
  }

  const c = data.case;
  const staff = hasRole('reviewer', 'admin');
  const owner = c.submitterId === user.id;
  const canEdit = (owner || hasRole('admin')) && isEditableBySubmitter(c);
  const processing = isProcessing(data);
  const lastDecision = data.decisions[0];

  const run = async (key, fn, success) => {
    setBusy(key);
    try { await fn(); if (success) toast.success(success); await reload({ silent: true }); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(''); }
  };

  return (
    <>
      <Link to="/cases" className="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-700">
        <Icon name="arrowLeft" size={15} /> Cases
      </Link>
      <PageHeader
        eyebrow={<span className="font-mono">{c.reference}</span>}
        title={c.title}
        description={`Applicant ${c.applicantName}${c.applicantDob ? ` · born ${formatDate(c.applicantDob)}` : ''} · submitted by ${c.submitterName}`}
        actions={(
          <>
            <Button variant="secondary" size="sm" icon={<Icon name="history" size={15} />} onClick={() => setHistoryOpen(true)}>History</Button>
            <Button variant="secondary" size="sm" icon={<Icon name="report" size={15} />} loading={busy === 'report'}
              onClick={() => run('report', () => caseService.openReport(c.id))}>Report</Button>
            {canEdit && <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>Edit details</Button>}
            {staff && c.status === 'submitted' && c.assignedReviewerId !== user.id && (
              <Button variant="secondary" size="sm" loading={busy === 'assign'} onClick={() => run('assign', () => caseService.assign(c.id, user.id), 'Case assigned to you')}>Assign to me</Button>
            )}
            {canEdit && (
              <Button size="sm" disabled={!data.documents.length} loading={busy === 'submit'}
                onClick={() => run('submit', () => caseService.submit(c.id), 'Case submitted for review')}>
                {c.status === 'correction_requested' ? 'Resubmit for review' : 'Submit for review'}
              </Button>
            )}
          </>
        )}
      />

      {/* Status strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-stone-500 uppercase">Automated checks</div>
          <div className="mt-2"><StatusBadge map={PRELIMINARY_STATUS} value={c.preliminaryStatus} /></div>
          <p className="mt-2 text-xs text-stone-500">Preliminary only — not an approval.</p>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-stone-500 uppercase">Case status</div>
          <div className="mt-2"><StatusBadge map={CASE_STATUS} value={c.status} /></div>
          <p className="mt-2 text-xs text-stone-500">{c.assignedReviewerName ? `Reviewer: ${c.assignedReviewerName}` : 'No reviewer assigned'}</p>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-stone-500 uppercase">Issues</div>
          <div className="mt-1.5 flex items-baseline gap-4 font-mono">
            <span className="text-2xl text-red-700">{data.summary.errors}<span className="ml-1 font-sans text-xs text-stone-500">errors</span></span>
            <span className="text-2xl text-amber-700">{data.summary.warnings}<span className="ml-1 font-sans text-xs text-stone-500">warnings</span></span>
          </div>
          <p className="mt-1 text-xs text-stone-500">{data.summary.passedChecks} checks passed</p>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-stone-500 uppercase">Documents</div>
          <div className="mt-1.5 font-mono text-2xl">{data.documents.length}</div>
          <p className="mt-1 text-xs text-stone-500">{processing ? `${data.summary.processing} still processing…` : `Updated ${formatDateTime(c.updatedAt)}`}</p>
        </div>
      </div>

      {c.status === 'correction_requested' && lastDecision && (
        <Alert tone="warning" className="mb-6" title="The reviewer asked for corrections">
          “{lastDecision.comment}” — {lastDecision.reviewerName}, {formatDateTime(lastDecision.createdAt)}.
          {owner && ' Upload corrected documents or edit the details, then resubmit.'}
        </Alert>
      )}
      {(c.status === 'approved' || c.status === 'rejected') && lastDecision && (
        <Alert tone={c.status === 'approved' ? 'success' : 'error'} className="mb-6" title={`${DECISIONS[lastDecision.decision].past} by ${lastDecision.reviewerName}`}>
          {lastDecision.comment || 'No comment.'} <span className="text-xs opacity-75">({formatDateTime(lastDecision.createdAt)})</span>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card title="Documents" subtitle="Open a document to compare the original with the extracted data" bodyClassName="p-0">
            {canEdit && <div className="border-b border-line p-5"><UploadDropzone caseId={c.id} onUploaded={() => reload({ silent: true })} /></div>}
            {data.documents.length ? (
              <DocumentList caseId={c.id} documents={data.documents} results={data.results} documentTypes={data.documentTypes}
                canDelete={canEdit} onDelete={setToDelete} />
            ) : (
              <EmptyState title="No documents yet" description={canEdit ? 'Upload mark sheets, ID cards, invoices or application forms above.' : 'The submitter has not uploaded any documents.'} />
            )}
          </Card>

          <Card title="Automated check results" subtitle="Rule-based checks, comparisons with the entered details, and cross-document comparisons" bodyClassName="p-0"
            actions={processing && <Badge tone="info" dot pulse>Checking…</Badge>}>
            {c.issueSummary && (
              <div className="border-b border-line bg-brand-50/50 px-5 py-3 text-sm text-ink-800">
                <span className="mr-1 font-semibold">Summary:</span>{c.issueSummary}
                <span className="mt-1 block text-xs text-stone-500">Written by AI from the rule results below. It never changes a result.</span>
              </div>
            )}
            <IssueList results={data.results} documents={data.documents} caseId={c.id}
              emptyText={data.documents.length ? (processing ? 'Results appear when processing finishes.' : 'No issues found by the automated checks.') : 'No checks yet.'} />
          </Card>
        </div>

        <div className="space-y-6">
          {staff && c.status === 'submitted' && (
            <Card title="Your decision" subtitle="The final decision always rests with a reviewer">
              <DecisionPanel detail={data} onDone={() => reload({ silent: true })} />
            </Card>
          )}
          {staff && c.status === 'open' && hasRole('admin') && (
            <Alert tone="info">This case has not been submitted yet. Reviewers will see it after the submitter sends it for review.</Alert>
          )}
          <Card title="Case details">
            <dl className="space-y-2.5 text-sm">
              {[
                ['Reference', <span className="font-mono">{c.reference}</span>],
                ['Applicant', c.applicantName],
                ['Date of birth', formatDate(c.applicantDob)],
                ['Submitted by', c.submitterName],
                ['Created', formatDateTime(c.createdAt)],
                ['Submitted', formatDateTime(c.submittedAt)],
                ['Decided', formatDateTime(c.decidedAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-stone-500">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
            </dl>
          </Card>
          {data.decisions.length > 0 && (
            <Card title="Decision history" bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {data.decisions.map((d) => (
                  <li key={d.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={DECISIONS[d.decision].tone}>{DECISIONS[d.decision].past}</Badge>
                      <span className="text-xs text-stone-500">{formatDateTime(d.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-stone-700">{d.comment || <span className="text-stone-400">No comment</span>}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{d.reviewerName}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <CaseHistory caseId={c.id} open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit case details" description="Documents will be checked again against the new details.">
        <CaseForm initial={{ title: c.title, applicantName: c.applicantName, applicantDob: c.applicantDob || '' }} submitLabel="Save changes"
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => { await caseService.update(c.id, values); toast.success('Details updated'); setEditOpen(false); reload({ silent: true }); }} />
      </Modal>

      <Modal open={Boolean(toDelete)} onClose={() => setToDelete(null)} title="Delete document?" size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={busy === 'delete'}
              onClick={() => run('delete', () => documentService.remove(toDelete.id), 'Document deleted').then(() => setToDelete(null))}>Delete</Button>
          </>
        )}>
        <p className="text-sm text-stone-600"><b>{toDelete?.originalName}</b> and its extracted data will be removed. The audit history keeps a record of the deletion.</p>
      </Modal>
    </>
  );
}
