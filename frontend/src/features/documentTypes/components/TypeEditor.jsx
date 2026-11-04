import { useEffect, useState } from 'react';
import Input, { Textarea } from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Alert from '../../../components/common/Alert';
import Icon from '../../../components/common/Icon';
import { FIELD_TYPES, RULE_TYPES } from '../../../constants/app.constants';
import { errorMessage } from '../../../utils/format';

const EMPTY_FIELD = { key: '', label: '', type: 'string', required: false, sensitive: false };

const RULE_EXAMPLE = `[
  { "id": "dob_not_future", "type": "date_not_future", "field": "date_of_birth", "severity": "error" },
  { "id": "issue_before_expiry", "type": "date_order", "before": "issue_date", "after": "expiry_date" },
  { "id": "total_check", "type": "sum_equals", "fields": ["subtotal", "tax_amount"], "target": "total_amount", "tolerance": 1 }
]`;

/** Edits a document type's fields and validation rules without any code change. */
export default function TypeEditor({ type, creating, onSave }) {
  const [form, setForm] = useState(null);
  const [rulesText, setRulesText] = useState('[]');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = type || { key: '', name: '', description: '', fields: [{ ...EMPTY_FIELD }], rules: [], isActive: true };
    setForm({ ...t, fields: t.fields.map((f) => ({ ...f })) });
    setRulesText(JSON.stringify(t.rules, null, 2));
    setError('');
  }, [type]);

  if (!form) return null;

  const setField = (i, patch) => setForm((f) => ({ ...f, fields: f.fields.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));
  const move = (i, d) => setForm((f) => {
    const arr = [...f.fields]; const j = i + d;
    if (j < 0 || j >= arr.length) return f;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...f, fields: arr };
  });

  const save = async () => {
    let rules;
    try { rules = JSON.parse(rulesText || '[]'); } catch { setError('Rules must be valid JSON (an array of rule objects).'); return; }
    if (!Array.isArray(rules)) { setError('Rules must be a JSON array.'); return; }
    const fields = form.fields.filter((f) => f.key.trim()).map((f) => {
      const out = { key: f.key.trim(), label: f.label.trim() || f.key.trim(), type: f.type, required: Boolean(f.required), sensitive: Boolean(f.sensitive) };
      for (const k of ['pattern', 'patternMessage', 'compareAs', 'submitterField', 'hint']) if (f[k]) out[k] = f[k];
      if (f.type === 'array') out.itemFields = f.itemFields || [{ key: 'description', label: 'Description', type: 'string' }, { key: 'amount', label: 'Amount', type: 'number' }];
      return out;
    });
    setSaving(true); setError('');
    try {
      await onSave({ ...(creating ? { key: form.key.trim() } : {}), name: form.name.trim(), description: form.description?.trim() || undefined,
        fields, rules, isActive: form.isActive });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Key" value={form.key} disabled={!creating} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
          hint="Lowercase identifier, e.g. bank_statement" required />
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <Textarea label="Description" hint="Also shown to the AI when classifying documents" value={form.description || ''}
        onChange={(e) => setForm({ ...form, description: e.target.value })} inputClassName="min-h-[60px]" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        Active (new documents can be classified as this type)
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Fields</h3>
          <Button size="sm" variant="secondary" onClick={() => setForm({ ...form, fields: [...form.fields, { ...EMPTY_FIELD }] })}>+ Add field</Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Key</th><th className="px-2 py-2 text-left font-medium">Label</th>
                <th className="px-2 py-2 text-left font-medium">Type</th><th className="px-2 py-2 font-medium">Req.</th>
                <th className="px-2 py-2 font-medium">Sensitive</th><th className="px-2 py-2 text-left font-medium">Compare across docs</th>
                <th className="px-2 py-2 text-left font-medium">Match case detail</th><th className="px-2 py-2 text-left font-medium">Pattern (regex)</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {form.fields.map((f, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={i}>
                  <td className="p-1"><input className="field h-8 px-2 py-1 font-mono text-xs" value={f.key} aria-label="Field key"
                    onChange={(e) => setField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} /></td>
                  <td className="p-1"><input className="field h-8 px-2 py-1 text-xs" value={f.label} aria-label="Field label" onChange={(e) => setField(i, { label: e.target.value })} /></td>
                  <td className="p-1"><select className="field h-8 px-2 py-1 text-xs" value={f.type} aria-label="Field type" onChange={(e) => setField(i, { type: e.target.value })}>
                    {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></td>
                  <td className="p-1 text-center"><input type="checkbox" className="accent-brand-700" checked={Boolean(f.required)} aria-label="Required" onChange={(e) => setField(i, { required: e.target.checked })} /></td>
                  <td className="p-1 text-center"><input type="checkbox" className="accent-brand-700" checked={Boolean(f.sensitive)} aria-label="Sensitive" onChange={(e) => setField(i, { sensitive: e.target.checked })} /></td>
                  <td className="p-1"><select className="field h-8 px-2 py-1 text-xs" value={f.compareAs || ''} aria-label="Compare as" onChange={(e) => setField(i, { compareAs: e.target.value || undefined })}>
                    <option value="">—</option><option value="person_name">Person name</option><option value="date_of_birth">Date of birth</option><option value="father_name">Father’s name</option></select></td>
                  <td className="p-1"><select className="field h-8 px-2 py-1 text-xs" value={f.submitterField || ''} aria-label="Submitter field" onChange={(e) => setField(i, { submitterField: e.target.value || undefined })}>
                    <option value="">—</option><option value="applicant_name">Applicant name</option><option value="applicant_dob">Applicant DOB</option></select></td>
                  <td className="p-1"><input className="field h-8 px-2 py-1 font-mono text-xs" value={f.pattern || ''} placeholder="optional" aria-label="Pattern" onChange={(e) => setField(i, { pattern: e.target.value || undefined })} /></td>
                  <td className="p-1 whitespace-nowrap">
                    <button type="button" className="px-1 text-stone-400 hover:text-ink-900" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className="px-1 text-stone-400 hover:text-ink-900" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button type="button" className="px-1 text-stone-400 hover:text-red-600" onClick={() => setForm({ ...form, fields: form.fields.filter((_, idx) => idx !== i) })} aria-label="Remove field"><Icon name="x" size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Validation rules (JSON)</h3>
        <p className="mb-2 text-xs text-stone-500">Available types: <span className="font-mono">{RULE_TYPES.join(', ')}</span>. Severity is error, warning or info.</p>
        <textarea className="field min-h-[220px] font-mono text-xs leading-relaxed" spellCheck={false} value={rulesText} onChange={(e) => setRulesText(e.target.value)} aria-label="Rules JSON" />
        <details className="mt-2 text-xs text-stone-500"><summary className="cursor-pointer">Example rules</summary><pre className="mt-2 rounded-lg bg-stone-50 p-3 font-mono">{RULE_EXAMPLE}</pre></details>
      </div>

      <div className="flex justify-end"><Button loading={saving} onClick={save}>{creating ? 'Create document type' : 'Save changes'}</Button></div>
    </div>
  );
}
