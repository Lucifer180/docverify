import { useRef, useState } from 'react';
import Button from '../../../components/common/Button';
import Icon from '../../../components/common/Icon';
import { ACCEPTED_FILES, MAX_FILE_SIZE_MB } from '../../../constants/app.constants';
import { caseService } from '../../../services/case.service';
import { useToast } from '../../../context/ToastContext';
import { cx, errorMessage, formatBytes } from '../../../utils/format';

const OK_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Drag-and-drop upload with client-side checks (the server checks the real file content again). */
export default function UploadDropzone({ caseId, onUploaded }) {
  const input = useRef(null);
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [problems, setProblems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);

  const addFiles = (list) => {
    const next = []; const bad = [];
    for (const f of list) {
      if (!OK_TYPES.includes(f.type) && !/\.(pdf|jpe?g|png)$/i.test(f.name)) bad.push(`${f.name}: only PDF, JPG and PNG are allowed`);
      else if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) bad.push(`${f.name}: larger than ${MAX_FILE_SIZE_MB} MB`);
      else if (f.size === 0) bad.push(`${f.name}: the file is empty`);
      else next.push(f);
    }
    setProblems(bad);
    setFiles((cur) => [...cur, ...next.filter((n) => !cur.some((c) => c.name === n.name && c.size === n.size))].slice(0, 10));
  };

  const upload = async () => {
    setProgress(0);
    try {
      const docs = await caseService.upload(caseId, files, setProgress);
      toast.success(`${docs.length} document(s) uploaded. Processing has started.`);
      setFiles([]); setProblems([]);
      onUploaded?.();
    } catch (err) {
      const errs = err?.response?.data?.errors;
      setProblems(Array.isArray(errs) ? errs.map((x) => (typeof x === 'string' ? x : x.message)) : [errorMessage(err)]);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <div
        role="button" tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-line bg-stone-50/50 hover:border-brand-200 hover:bg-brand-50/40',
        )}>
        <Icon name="upload" size={26} className="text-brand-700" />
        <p className="mt-2 text-sm font-medium">Drop files here or <span className="text-brand-700 underline">browse</span></p>
        <p className="mt-0.5 text-xs text-stone-500">PDF, JPG or PNG · up to {MAX_FILE_SIZE_MB} MB each · max 10 at a time</p>
        <input ref={input} type="file" multiple accept={ACCEPTED_FILES} className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f) => (
            <div key={f.name + f.size} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
              <Icon name="file" className="text-stone-400" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-stone-500">{formatBytes(f.size)}</span>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x !== f))}
                className="text-stone-400 hover:text-red-600" aria-label={`Remove ${f.name}`}><Icon name="x" size={16} /></button>
            </div>
          ))}
          <div className="flex items-center justify-end gap-3 pt-1">
            {progress !== null && (
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={() => setFiles([])} disabled={progress !== null}>Clear</Button>
            <Button size="sm" onClick={upload} loading={progress !== null} icon={<Icon name="upload" size={15} />}>
              Upload {files.length} file{files.length > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
