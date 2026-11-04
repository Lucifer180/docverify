import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../components/common/Badge';
import { CASE_STATUS, PRELIMINARY_STATUS } from '../../../constants/app.constants';
import { timeAgo } from '../../../utils/formatDate';

export default function CaseTable({ cases, showSubmitter = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead className="border-b border-line bg-stone-50/60">
          <tr>
            <th className="table-head">Case</th>
            <th className="table-head">Applicant</th>
            {showSubmitter && <th className="table-head">Submitted by</th>}
            <th className="table-head">Automated checks</th>
            <th className="table-head">Status</th>
            <th className="table-head text-right">Docs</th>
            <th className="table-head text-right">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {cases.map((c) => (
            <tr key={c.id} className="group hover:bg-brand-50/40">
              <td className="table-cell">
                <Link to={`/cases/${c.id}`} className="block">
                  <div className="font-mono text-xs text-stone-500">{c.reference}</div>
                  <div className="font-medium text-ink-900 group-hover:text-brand-700">{c.title}</div>
                </Link>
              </td>
              <td className="table-cell">{c.applicantName}</td>
              {showSubmitter && <td className="table-cell text-stone-600">{c.submitterName}</td>}
              <td className="table-cell"><StatusBadge map={PRELIMINARY_STATUS} value={c.preliminaryStatus} /></td>
              <td className="table-cell"><StatusBadge map={CASE_STATUS} value={c.status} /></td>
              <td className="table-cell text-right font-mono">{c.documentCount}</td>
              <td className="table-cell text-right text-stone-500">{timeAgo(c.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
