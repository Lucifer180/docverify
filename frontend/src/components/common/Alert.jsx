import { cx } from '../../utils/format';

const TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  success: 'border-green-200 bg-green-50 text-green-900',
};

export default function Alert({ tone = 'info', title, children, className, action }) {
  return (
    <div className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', TONES[tone], className)} role={tone === 'error' ? 'alert' : undefined}>
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
