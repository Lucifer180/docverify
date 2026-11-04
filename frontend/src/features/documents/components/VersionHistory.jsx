import Badge from '../../../components/common/Badge';
import Loader from '../../../components/common/Loader';
import { useAsync } from '../../../hooks/useAsync';
import { documentService } from '../../../services/document.service';
import { formatDateTime } from '../../../utils/formatDate';

const SOURCE = { llm: ['AI extraction', 'brand'], reviewer: ['Reviewer correction', 'info'], manual: ['Manual entry', 'flag'] };

function diff(newer, older) {
  if (!older) return [];
  const keys = new Set([...Object.keys(newer || {}), ...Object.keys(older || {})]);
  return [...keys].filter((k) => JSON.stringify(newer?.[k] ?? null) !== JSON.stringify(older?.[k] ?? null))
    .map((k) => ({ key: k, from: older?.[k], to: newer?.[k] }));
}

const show = (v) => (v === null || v === undefined || v === '' ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function VersionHistory({ documentId, reveal, refreshKey }) {
  const { data, loading } = useAsync(() => documentService.versions(documentId, reveal), [documentId, reveal, refreshKey]);
  if (loading && !data) return <Loader label="Loading versions…" />;
  if (!data?.length) return <p className="text-sm text-stone-500">No extracted data yet.</p>;
  return (
    <ol className="space-y-3">
      {data.map((v, i) => {
        const changes = diff(v.data, data[i + 1]?.data);
        const [label, tone] = SOURCE[v.source] || [v.source, 'neutral'];
        return (
          <li key={v.id} className="rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono font-medium">v{v.version}</span>
              <Badge tone={tone}>{label}</Badge>
              {i === 0 && <Badge tone="pass">Current</Badge>}
              <span className="ml-auto text-xs text-stone-500">{formatDateTime(v.createdAt)}{v.createdByName ? ` · ${v.createdByName}` : ''}</span>
            </div>
            {v.note && <p className="mt-1.5 text-xs text-stone-600 italic">“{v.note}”</p>}
            {changes.length > 0 && (
              <ul className="mt-2 space-y-0.5 font-mono text-xs">
                {changes.map((c) => (
                  <li key={c.key}><span className="text-stone-500">{c.key}:</span> <span className="text-red-700 line-through">{show(c.from)}</span> → <span className="text-green-800">{show(c.to)}</span></li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
