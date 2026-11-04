import { DOCUMENT_STATUS } from '../../../constants/app.constants';
import { cx } from '../../../utils/format';

const STEPS = ['Uploaded', 'Text', 'Fields', 'Checked'];

/** Compact pipeline indicator: Uploaded → Text extracted → Fields extracted → Checked. */
export default function ProcessingSteps({ status }) {
  const current = DOCUMENT_STATUS[status]?.step || 1;
  const failed = status === 'processing_failed';
  return (
    <ol className="flex items-center gap-1" aria-label={`Processing: ${DOCUMENT_STATUS[status]?.label}`}>
      {STEPS.map((s, i) => {
        const n = i + 1;
        const done = n < current || (n === current && current === 4);
        const active = n === current && current < 4;
        return (
          <li key={s} className="flex items-center gap-1">
            <span title={s} className={cx(
              'h-1.5 w-7 rounded-full',
              failed && n === 4 ? 'bg-red-500' : done ? 'bg-brand-600' : active ? 'animate-pulse bg-brand-200' : 'bg-stone-200',
            )} />
          </li>
        );
      })}
    </ol>
  );
}
