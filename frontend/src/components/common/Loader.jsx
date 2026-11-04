import { cx } from '../../utils/format';

const SIZES = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[3px]' };

export default function Loader({ size = 'md', className, label }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)} role="status">
      <span className={cx('animate-spin rounded-full border-current border-r-transparent text-brand-600', SIZES[size])} />
      {label ? <span className="text-sm text-stone-500">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return <div className="flex min-h-[40vh] items-center justify-center"><Loader size="lg" label={label} /></div>;
}
