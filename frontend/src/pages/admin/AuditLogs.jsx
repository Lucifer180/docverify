import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Loader from '../../components/common/Loader';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { auditService } from '../../services/admin.service';
import { formatDateTime } from '../../utils/formatDate';

const GROUPS = [['', 'All actions'], ['user.', 'Accounts'], ['case.', 'Cases'], ['document.', 'Documents'],
  ['processing.', 'Processing'], ['fields.', 'Field corrections & reveals'], ['document_type.', 'Configuration']];

export default function AuditLogs() {
  const [action, setAction] = useState('');
  const [entityId, setEntityId] = useState('');
  const [offset, setOffset] = useState(0);
  const id = useDebounce(entityId.trim());
  const limit = 30;
  const { data, loading } = useAsync(
    () => auditService.list({ limit, offset, ...(action && { action }), ...(id && { entityId: id }) }),
    [action, id, offset],
  );

  return (
    <>
      <PageHeader eyebrow="Administration" title="Audit log"
        description="Append-only record of every upload, processing step, correction and decision. Entries cannot be edited or deleted." />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <select className="field w-auto" value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }} aria-label="Action">
            {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="field max-w-xs font-mono" placeholder="Filter by case / document id" value={entityId}
            onChange={(e) => { setEntityId(e.target.value); setOffset(0); }} aria-label="Entity id" />
        </div>
        {loading && !data ? <div className="p-10 text-center"><Loader /></div> : !data.items.length ? <EmptyState title="No entries" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-line bg-stone-50/60">
                  <tr><th className="table-head">Time</th><th className="table-head">User</th><th className="table-head">Action</th><th className="table-head">Entity</th><th className="table-head">Details</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="table-cell font-mono text-xs whitespace-nowrap text-stone-500">{formatDateTime(e.createdAt)}</td>
                      <td className="table-cell text-xs">{e.userEmail || 'system'}{e.ipAddress && <div className="text-stone-400">{e.ipAddress}</div>}</td>
                      <td className="table-cell font-mono text-xs">{e.action}</td>
                      <td className="table-cell text-xs">
                        {e.entityType}
                        {e.entityId && (e.entityType === 'case'
                          ? <Link to={`/cases/${e.entityId}`} className="block font-mono text-brand-700 hover:underline">{e.entityId.slice(0, 8)}…</Link>
                          : <button type="button" className="block font-mono text-stone-500 hover:text-brand-700" onClick={() => setEntityId(e.entityId)}>{e.entityId.slice(0, 8)}…</button>)}
                      </td>
                      <td className="table-cell"><code className="block max-w-md font-mono text-[11px] break-all text-stone-600">{Object.keys(e.details).length ? JSON.stringify(e.details) : ''}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={data.total} limit={limit} offset={offset} onChange={setOffset} />
          </>
        )}
      </div>
    </>
  );
}
