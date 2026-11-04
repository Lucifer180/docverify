import { Link } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/Loader';
import Alert from '../components/common/Alert';
import CaseTable from '../features/cases/components/CaseTable';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { caseService } from '../services/case.service';
import { systemService } from '../services/admin.service';
import { formatMs } from '../utils/format';
import { cx } from '../utils/format';

function Stat({ label, value, tone = 'ink', to, hint }) {
  const tones = { ink: 'text-ink-900', pass: 'text-green-700', flag: 'text-amber-700', fail: 'text-red-700', brand: 'text-brand-700' };
  const body = (
    <div className="card h-full p-4 transition hover:border-brand-200">
      <div className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</div>
      <div className={cx('mt-1.5 font-mono text-3xl font-medium', tones[tone])}>{value ?? 0}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const staff = hasRole('reviewer', 'admin');
  const { data, loading, error } = useAsync(() => caseService.dashboard(), [], {
    poll: (d) => d.preliminary?.processing > 0, interval: 4000,
  });
  const { data: health } = useAsync(() => systemService.health(), [], { enabled: hasRole('admin') });

  if (loading && !data) return <PageLoader />;
  if (error) return <Alert tone="error">Could not load the dashboard. Is the backend running?</Alert>;

  const s = data.status || {};
  const p = data.preliminary || {};
  const first = user.name.split(' ')[0];

  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`Hello, ${first}`}
        description={staff ? 'Cases waiting for a decision and how the automated checks are performing.' : 'Your cases and their verification status.'}
        actions={hasRole('submitter', 'admin') && (
          <Link to="/cases/new"><Button icon={<Icon name="plus" size={16} />}>New case</Button></Link>
        )} />

      {health?.llm?.provider === 'mock' && (
        <Alert tone="warning" className="mb-6" title="Running with the offline extractor">
          Grok is not configured, so a simple rule-based extractor is used. Add <code className="font-mono">GROK_API_KEY</code> to
          <code className="font-mono"> backend/.env</code> and set <code className="font-mono">LLM_PROVIDER=grok</code> for AI extraction.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {staff ? (
          <>
            <Stat label="Awaiting decision" value={data.awaitingReview} tone="brand" to="/cases?status=submitted" />
            <Stat label="Flagged for review" value={p.flagged} tone="flag" to="/cases?preliminaryStatus=flagged" />
            <Stat label="Passed checks" value={p.passed} tone="pass" to="/cases?preliminaryStatus=passed" />
            <Stat label="Processing now" value={p.processing} />
          </>
        ) : (
          <>
            <Stat label="Open" value={(s.open || 0) + (s.correction_requested || 0)} tone="brand" hint={s.correction_requested ? `${s.correction_requested} need corrections` : 'Not yet submitted'} />
            <Stat label="Under review" value={s.submitted} />
            <Stat label="Approved" value={s.approved} tone="pass" />
            <Stat label="Rejected" value={s.rejected} tone="fail" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card title="Recent cases" bodyClassName="p-0" actions={<Link to="/cases" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>}>
          {data.recent.length ? <CaseTable cases={data.recent} showSubmitter={staff} /> : (
            <EmptyState title="No cases yet" description={staff ? 'Cases appear here once submitters send them for review.' : 'Create a case and upload documents to get started.'}
              action={!staff && <Link to="/cases/new"><Button>Create your first case</Button></Link>} />
          )}
        </Card>

        {staff && data.processing ? (
          <Card title="Processing performance" subtitle="Measured on all processed documents">
            <dl className="space-y-3 text-sm">
              {[
                ['Documents processed', data.processing.documents],
                ['Average end-to-end time', formatMs(data.processing.avgProcessingMs)],
                ['Slowest document', formatMs(data.processing.maxProcessingMs)],
                ['Average text extraction / OCR', formatMs(data.processing.avgTextMs)],
                ['Average AI extraction', formatMs(data.processing.avgLlmMs)],
                ['Needed manual entry', data.processing.manualEntry],
                ['Processing failures', data.processing.failed],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-dashed border-line pb-2 last:border-0">
                  <dt className="text-stone-500">{k}</dt><dd className="font-mono">{v}</dd>
                </div>
              ))}
            </dl>
            {health && <p className="mt-4 text-xs text-stone-500">AI model: <span className="font-mono">{health.llm.model}</span></p>}
          </Card>
        ) : !staff && (
          <Card title="How it works">
            <ol className="space-y-3 text-sm text-stone-600">
              <li><b className="text-ink-900">1. Create a case</b> with the applicant’s name and date of birth.</li>
              <li><b className="text-ink-900">2. Upload documents</b> — mark sheets, ID cards, invoices or forms.</li>
              <li><b className="text-ink-900">3. Check the results.</b> Fix anything flagged, then submit.</li>
              <li><b className="text-ink-900">4. A reviewer decides</b> and may ask you for corrections.</li>
            </ol>
          </Card>
        )}
      </div>
    </>
  );
}
