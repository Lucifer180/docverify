import { cx } from '../../utils/format';

const TONES = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  pass: 'bg-green-50 text-green-800 ring-green-200',
  flag: 'bg-amber-50 text-amber-800 ring-amber-200',
  fail: 'bg-red-50 text-red-800 ring-red-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
};
const DOTS = { neutral: 'bg-stone-400', info: 'bg-sky-500', pass: 'bg-green-600', flag: 'bg-amber-500', fail: 'bg-red-600', brand: 'bg-brand-600' };

export default function Badge({ tone = 'neutral', children, dot = false, pulse = false, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', DOTS[tone], pulse && 'animate-pulse')} />}
      {children}
    </span>
  );
}

/** Badge driven by one of the status maps in app.constants. */
export function StatusBadge({ map, value, className }) {
  const item = map[value] || { label: value, tone: 'neutral' };
  return <Badge tone={item.tone} dot pulse={item.tone === 'info' && value !== 'submitted'} className={className}>{item.label}</Badge>;
}
