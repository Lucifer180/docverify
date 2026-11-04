import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Icon from '../../components/common/Icon';
import { PageLoader } from '../../components/common/Loader';
import TypeEditor from '../../features/documentTypes/components/TypeEditor';
import { useAsync } from '../../hooks/useAsync';
import { documentTypeService } from '../../services/admin.service';
import { useToast } from '../../context/ToastContext';
import { cx } from '../../utils/format';

export default function DocumentTypes() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => documentTypeService.list(true), []);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  if (loading && !data) return <PageLoader />;
  const current = creating ? null : data.find((t) => t.key === selected) || data[0];

  return (
    <>
      <PageHeader eyebrow="Administration" title="Document types & rules"
        description="Choose which fields the AI extracts for each type and which rules check them. Changes apply to documents processed or re-checked afterwards."
        actions={<Button icon={<Icon name="plus" size={16} />} onClick={() => setCreating(true)}>New type</Button>} />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="card h-fit p-2">
          {data.map((t) => (
            <button key={t.key} type="button" onClick={() => { setCreating(false); setSelected(t.key); }}
              className={cx('flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                !creating && current?.key === t.key ? 'bg-brand-50 font-medium text-brand-800' : 'hover:bg-stone-50')}>
              <span className="truncate">{t.name}</span>
              <span className="flex items-center gap-1.5">
                {!t.isActive && <Badge>Off</Badge>}
                <span className="font-mono text-xs text-stone-400">{t.fields.length}f · {t.rules.length}r</span>
              </span>
            </button>
          ))}
        </nav>
        <Card title={creating ? 'New document type' : current?.name} subtitle={creating ? undefined : <span className="font-mono">{current?.key}</span>}>
          <TypeEditor type={current} creating={creating}
            onSave={async (payload) => {
              const saved = creating ? await documentTypeService.create(payload) : await documentTypeService.update(current.key, payload);
              toast.success(`Saved ${saved.name}`);
              setCreating(false); setSelected(saved.key);
              reload({ silent: true });
            }} />
        </Card>
      </div>
    </>
  );
}
