import { cx } from '../../utils/format';
import Loader from './Loader';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-ink-900 border border-line hover:bg-stone-50',
  ghost: 'text-ink-800 hover:bg-stone-100',
  danger: 'bg-red-700 text-white hover:bg-red-800 shadow-sm',
  warning: 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm',
  success: 'bg-green-700 text-white hover:bg-green-800 shadow-sm',
};
const SIZES = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm' };

export default function Button({ variant = 'primary', size = 'md', loading = false, disabled, className, children, icon, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition',
        'disabled:cursor-not-allowed disabled:opacity-55', VARIANTS[variant], SIZES[size], className,
      )}
      {...props}
    >
      {loading ? <Loader size="sm" className="text-current" /> : icon}
      {children}
    </button>
  );
}
