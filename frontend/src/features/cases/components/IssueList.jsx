import { useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../../../components/common/Badge';
import Icon from '../../../components/common/Icon';
import { SEVERITY } from '../../../constants/app.constants';
import { cx } from '../../../utils/format';
import { ruleLabel } from '../case.utils';

function IssueRow({ r, caseId, documentName }) {
  const passed = r.passed;
  return (
    <li className="flex gap-3 px-5 py-3">
      <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
        passed ? 'bg-green-100 text-green-700' : r.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
        <Icon name={passed ? 'check' : 'alert'} size={12} strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{r.message}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
          {!passed && <Badge tone={SEVERITY[r.severity].tone}>{SEVERITY[r.severity].label}</Badge>}
          <span className="font-medium text-stone-600">{ruleLabel(r.rule)}</span>
          {r.scope === 'case' ? <span>· across documents</span> : documentName && caseId && (
            <Link to={`/cases/${caseId}/documents/${r.documentId}`} className="truncate hover:text-brand-700 hover:underline">· {documentName}</Link>
          )}
          {r.details?.similarity !== undefined && r.details.match !== 'match' && <span>· similarity {Math.round(r.details.similarity * 100)}%</span>}
        </div>
      </div>
    </li>
  );
}

/** Lists check results. Shows only problems by default, with a toggle to see every check that ran. */
export default function IssueList({ results, documents = [], caseId, emptyText = 'No issues found by the automated checks.' }) {
  const [showAll, setShowAll] = useState(false);
  const problems = results.filter((r) => !r.passed && r.severity !== 'info')
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const shown = showAll ? [...problems, ...results.filter((r) => r.passed)] : problems;
  const nameOf = (id) => documents.find((d) => d.id === id)?.originalName;

  return (
    <div>
      {shown.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-green-800">
          <Icon name="check" className="text-green-600" /> {emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((r) => <IssueRow key={r.id} r={r} caseId={caseId} documentName={nameOf(r.documentId)} />)}
        </ul>
      )}
      {results.some((r) => r.passed) && (
        <button type="button" onClick={() => setShowAll((s) => !s)}
          className="w-full border-t border-line px-5 py-2.5 text-left text-xs font-medium text-brand-700 hover:bg-stone-50">
          {showAll ? 'Show issues only' : `Show all ${results.length} checks (${results.filter((r) => r.passed).length} passed)`}
        </button>
      )}
    </div>
  );
}
