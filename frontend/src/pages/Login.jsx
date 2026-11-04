import LoginForm from '../features/auth/components/LoginForm';

export default function Login() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-stone-500">Use your account to submit or review documents.</p>
      <LoginForm />
    </>
  );
}
