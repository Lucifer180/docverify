import { forwardRef, useId } from 'react';
import { cx } from '../../utils/format';

function FieldWrap({ id, label, error, hint, className, children, required }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}{required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

const Input = forwardRef(function Input({ label, error, hint, className, inputClassName, required, ...props }, ref) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint} className={className} required={required}>
      <input id={id} ref={ref} required={required} aria-invalid={Boolean(error)}
        className={cx('field', error && 'border-red-400 focus:border-red-500 focus:ring-red-100', inputClassName)} {...props} />
    </FieldWrap>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, className, children, required, ...props }, ref) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint} className={className} required={required}>
      <select id={id} ref={ref} required={required} className={cx('field pr-8', error && 'border-red-400')} {...props}>{children}</select>
    </FieldWrap>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, className, inputClassName, required, ...props }, ref) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint} className={className} required={required}>
      <textarea id={id} ref={ref} required={required} className={cx('field min-h-[84px]', error && 'border-red-400', inputClassName)} {...props} />
    </FieldWrap>
  );
});

export default Input;
