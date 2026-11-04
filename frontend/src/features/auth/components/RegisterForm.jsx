import { Link, useNavigate } from 'react-router-dom';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Alert from '../../../components/common/Alert';
import { useAuth } from '../../../context/AuthContext';
import { useAuthForm } from '../hooks/useAuthForm';
import { validateRegister } from '../auth.validation';

export default function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { bind, handleSubmit, formError, submitting } = useAuthForm(
    { name: '', email: '', password: '', confirm: '' }, validateRegister,
    async ({ name, email, password }) => {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate('/dashboard', { replace: true });
    },
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <Input label="Full name" autoComplete="name" autoFocus {...bind('name')} />
      <Input label="Email" type="email" autoComplete="email" {...bind('email')} />
      <Input label="Password" type="password" autoComplete="new-password" hint="At least 8 characters with letters and numbers" {...bind('password')} />
      <Input label="Confirm password" type="password" autoComplete="new-password" {...bind('confirm')} />
      <Button type="submit" className="w-full" size="lg" loading={submitting}>Create account</Button>
      <p className="text-center text-sm text-stone-500">
        Already registered? <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
