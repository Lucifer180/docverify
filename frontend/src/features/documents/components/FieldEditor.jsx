import { useEffect, useMemo, useState } from 'react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import { Textarea } from '../../../components/common/Input';
import { cx } from '../../../utils/format';

const LONG_FIELDS = new Set(['address', 'summary']);

function toInput(field, value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function fromInput(field, raw) {
  if (raw === '' || raw === null) return null;
  if (field.type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

function ArrayField({ field, value, onChange, readOnly }) {
  const rows = Array.isArray(value) ? value : [];
  const cols = field.itemFields || [];
  const setCell = (i, key, raw) => {
    const col = cols.find((c) => c.key === key);
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: fromInput(col, raw) } : r)));
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-stone-50">
          <tr>{cols.map((c) => <th key={c.key} className="px-2 py-1.5 text-left text-xs font-medium text-stone-500">{c.label}</th>)}{!readOnly && <th />}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-2 py-2 text-xs text-stone-400">No items</td></tr>}
          {rows.map((r, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.key} className="px-1 py-1">
                  {readOnly ? <span className="px-1 font-mono text-xs">{r[c.key] ?? '—'}</span> : (
                    <input className="field h-8 px-2 py-1 text-xs" type={c.type === 'number' ? 'number' : 'text'} step="any"
                      value={toInput(c, r[c.key])} onChange={(e) => setCell(i, c.key, e.target.value)} aria-label={`${c.label} row ${i + 1}`} />
                  )}
                </td>
              ))}
              {!readOnly && (
                <td className="w-8 px-1">
                  <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="text-stone-400 hover:text-red-600" aria-label="Remove row">
                    <Icon name="x" size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <button type="button" onClick={() => onChange([...rows, Object.fromEntries(cols.map((c) => [c.key, null]))])}
          className="w-full border-t border-line px-3 py-1.5 text-left text-xs font-medium text-brand-700 hover:bg-stone-50">+ Add row</button>
      )}
    </div>
  );
}

/**
 * Shows extracted fields next to the original. Reviewers can correct values or change the
 * document type; every save creates a new version (the AI's original values are kept).
 */
export default function FieldEditor({ typeDef, allTypes, documentType, data, issuesByField, editable, sensitiveRevealed, onSave }) {
  const [selectedType, setSelectedType] = useState(documentType);
  const [values, setValues] = useState(data || {});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValues(data || {}); setSelectedType(documentType); }, [data, documentType]);

  const activeType = useMemo(() => allTypes?.find((t) => t.key === selectedType) || typeDef, [allTypes, selectedType, typeDef]);
  const typeChanged = selectedType !== documentType;
  const dirty = typeChanged || JSON.stringify(values) !== JSON.stringify(data || {});

  if (!activeType) return <p className="text-sm text-stone-500">The document type is not known yet.</p>;

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(activeType.fields.map((f) => [f.key, values[f.key] ?? null]));
      await onSave({ documentType: typeChanged ? selectedType : undefined, fields: payload, note: note.trim() || undefined });
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {editable && allTypes && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <label htmlFor="doc-type" className="text-stone-500">Document type</label>
          <select id="doc-type" className="field h-8 w-auto py-1" value={selectedType || ''} onChange={(e) => setSelectedType(e.target.value)}>
            {allTypes.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
          {typeChanged && <span className="text-xs text-amber-700">Changing the type uses a different set of fields.</span>}
        </div>
      )}

      <div className="divide-y divide-line rounded-xl border border-line">
        {activeType.fields.map((f) => {
          const issues = issuesByField[f.key] || [];
          const hasError = issues.some((i) => i.severity === 'error');
          const value = values[f.key];
          const masked = f.sensitive && !sensitiveRevealed;
          return (
            <div key={f.key} className={cx('grid gap-1.5 px-4 py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4',
              issues.length && (hasError ? 'bg-red-50/60' : 'bg-amber-50/60'))}>
              <div className="pt-1.5 text-sm">
                <span className="font-medium text-ink-800">{f.label}</span>
                {f.required && <span className="ml-0.5 text-red-600">*</span>}
                <div className="flex items-center gap-1 text-[11px] text-stone-400">
                  <span>{f.type}</span>{f.sensitive && <><span>·</span><Icon name={masked ? 'eyeOff' : 'eye'} size={11} /><span>sensitive</span></>}
                </div>
              </div>
              <div>
                {f.type === 'array' ? (
                  <ArrayField field={f} value={value} readOnly={!editable} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
                ) : editable ? (
                  LONG_FIELDS.has(f.key) ? (
                    <textarea className="field min-h-[60px]" value={toInput(f, value)} aria-label={f.label}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: fromInput(f, e.target.value) }))} />
                  ) : (
                    <input className={cx('field font-mono', hasError && 'border-red-300')} aria-label={f.label}
                      type={f.type === 'number' ? 'number' : f.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? 'date' : 'text'}
                      step="any" value={toInput(f, value)} placeholder="Not found"
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: fromInput(f, e.target.value) }))} />
                  )
                ) : (
                  <div className={cx('min-h-[36px] rounded-lg px-3 py-2 font-mono text-sm', value === null || value === undefined || value === '' ? 'text-stone-400 italic' : 'bg-stone-50')}>
                    {value === null || value === undefined || value === '' ? 'Not found' : String(value)}
                  </div>
                )}
                {issues.map((i) => (
                  <p key={i.id} className={cx('mt-1 flex items-start gap-1 text-xs', i.severity === 'error' ? 'text-red-700' : 'text-amber-800')}>
                    <Icon name="alert" size={12} className="mt-0.5 shrink-0" />{i.message}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editable && (
        <div className="space-y-3 rounded-xl border border-dashed border-line p-4">
          <Textarea label="Correction note (optional)" placeholder="e.g. Date of birth corrected from the original scan"
            value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} inputClassName="min-h-[60px]" />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-stone-500">Saving creates a new version. All checks run again.</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={!dirty || saving} onClick={() => { setValues(data || {}); setSelectedType(documentType); }}>Undo</Button>
              <Button size="sm" disabled={!dirty} loading={saving} onClick={save}>Save corrections</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
