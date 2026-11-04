import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import EmptyState from '../components/common/EmptyState';
import Pagination from '../components/common/Pagination';
import Loader from '../components/common/Loader';
import Alert from '../components/common/Alert';
import CaseTable from '../features/cases/components/CaseTable';
import { useCases } from '../features/cases/hooks/useCases';
import { useAuth } from '../context/AuthContext';
import { CASE_STATUS, PRELIMINARY_STATUS } from '../constants/app.constants';
import { errorMessage } from '../utils/format';

export default function Cases() {
  const { hasRole } = useAuth();
  const staff = hasRole('reviewer', 'admin');
  const [params] = useSearchParams();
  const { data, loading, error, filters, update, setOffset } = useCases({
    status: params.get('status') || '', preliminaryStatus: params.get('preliminaryStatus') || '',
  });

  useEffect(() => {
    update({ status: params.get('status') || '', preliminaryStatus: params.get('preliminaryStatus') || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <>
      <PageHeader title="Cases" description={staff ? 'All cases submitted for review.' : 'Each case groups the documents for one applicant or transaction.'}
        actions={hasRole('submitter', 'admin') && <Link to="/cases/new"><Button icon={<Icon name="plus" size={16} />}>New case</Button></Link>} />

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Icon name="search" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
            <input className="field pl-9" placeholder="Search reference, title or applicant" value={filters.search}
              onChange={(e) => update({ search: e.target.value })} aria-label="Search cases" />
          </div>
          <select className="field w-auto" value={filters.preliminaryStatus} onChange={(e) => update({ preliminaryStatus: e.target.value })} aria-label="Automated checks">
            <option value="">All check results</option>
            {Object.entries(PRELIMINARY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="field w-auto" value={filters.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {Object.entries(CASE_STATUS).filter(([k]) => staff ? k !== 'open' : true).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {staff && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={filters.mine} onChange={(e) => update({ mine: e.target.checked })} className="h-4 w-4 accent-brand-700" />
              Assigned to me
            </label>
          )}
        </div>

        {error ? <div className="p-4"><Alert tone="error">{errorMessage(error)}</Alert></div>
          : loading && !data ? <div className="p-10 text-center"><Loader label="Loading cases…" /></div>
            : data.items.length === 0 ? (
              <EmptyState title="No cases found" description={filters.search || filters.status || filters.preliminaryStatus ? 'Try clearing the filters.' : 'There are no cases here yet.'} />
            ) : (
              <>
                <CaseTable cases={data.items} showSubmitter={staff} />
                <Pagination total={data.total} limit={filters.limit} offset={filters.offset} onChange={setOffset} />
              </>
            )}
      </div>
    </>
  );
}
