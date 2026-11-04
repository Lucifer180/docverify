import RegisterForm from '../features/auth/components/RegisterForm';

export default function Register() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-1 mb-6 text-sm text-stone-500">New accounts can submit documents. An administrator assigns reviewer access.</p>
      <RegisterForm />
    </>
  );
}
