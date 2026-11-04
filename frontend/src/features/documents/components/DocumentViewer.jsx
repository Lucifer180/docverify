import { useState } from 'react';
import Loader from '../../../components/common/Loader';
import Alert from '../../../components/common/Alert';
import Icon from '../../../components/common/Icon';
import { useFileLink } from '../hooks/useFileLink';
import { errorMessage } from '../../../utils/format';

function ToolButton({ label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium text-stone-200 hover:bg-white/10">
      {children}
    </button>
  );
}

/** Shows the original upload: images with zoom/rotate, PDFs in the browser's viewer. */
export default function DocumentViewer({ document }) {
  const { link, error, refresh } = useFileLink(document.id);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const isPdf = document.mimeType === 'application/pdf';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-ink-800 bg-ink-900">
      <div className="flex items-center gap-1 border-b border-white/10 px-3 py-1.5 text-stone-300">
        <span className="mr-auto truncate text-xs">{document.originalName}</span>
        {!isPdf && (
          <>
            <ToolButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>−</ToolButton>
            <span className="w-11 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
            <ToolButton label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>+</ToolButton>
            <ToolButton label="Fit" onClick={() => { setZoom(1); setRotation(0); }}>Fit</ToolButton>
            <ToolButton label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)}><Icon name="refresh" size={15} /></ToolButton>
          </>
        )}
        {link && (
          <a href={link.url} target="_blank" rel="noreferrer" className="flex h-8 items-center rounded-md px-2 text-xs font-medium text-stone-200 hover:bg-white/10">Open</a>
        )}
      </div>
      <div className="scroll-thin relative flex-1 overflow-auto bg-[radial-gradient(#ffffff14_1px,transparent_1px)] [background-size:16px_16px]">
        {error ? (
          <div className="p-4"><Alert tone="error" action={<button type="button" className="underline" onClick={refresh}>Retry</button>}>{errorMessage(error)}</Alert></div>
        ) : !link ? (
          <div className="flex h-full items-center justify-center"><Loader label="Loading original…" /></div>
        ) : isPdf ? (
          <iframe title={document.originalName} src={link.url} className="h-full min-h-[600px] w-full bg-white" />
        ) : (
          <div className="flex min-h-full items-start justify-center p-4">
            <img src={link.url} alt={`Original: ${document.originalName}`} onError={refresh}
              style={{ width: `${zoom * 100}%`, transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}
              className="max-w-none rounded bg-white shadow-xl transition-transform" />
          </div>
        )}
      </div>
    </div>
  );
}
