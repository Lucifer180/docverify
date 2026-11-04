import { Link, useLocation, useNavigate } from 'react-router-dom';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Alert from '../../../components/common/Alert';
import { useAuth } from '../../../context/AuthContext';
import { useAuthForm } from '../hooks/useAuthForm';
import { validateLogin } from '../auth.validation';

const DEMO = [
  ['Submitter', 'submitter@docverify.local', 'Submitter@123'],
  ['Reviewer', 'reviewer@docverify.local', 'Reviewer@123'],
  ['Admin', 'admin@docverify.local', 'Admin@123'],
];

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { bind, handleSubmit, formError, submitting, setValues } = useAuthForm(
    { email: '', password: '' }, validateLogin,
    async ({ email, password }) => {
      await login(email.trim(), password);
      navigate(location.state?.from || '/dashboard', { replace: true });
    },
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <Input label="Email" type="email" autoComplete="email" autoFocus {...bind('email')} />
      <Input label="Password" type="password" autoComplete="current-password" {...bind('password')} />
      <Button type="submit" className="w-full" size="lg" loading={submitting}>Sign in</Button>
      <p className="text-center text-sm text-stone-500">
        New here? <Link to="/register" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
      <div className="rounded-xl border border-dashed border-line p-3">
        <p className="mb-2 text-xs font-medium text-stone-500">Demo accounts (fill in with one click)</p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map(([label, email, password]) => (
            <button key={label} type="button" onClick={() => setValues({ email, password })}
              className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-ink-800 hover:bg-brand-50 hover:text-brand-800">
              {label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
