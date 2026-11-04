import { Link } from 'react-router-dom';
import Button from '../components/common/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="font-mono text-6xl font-medium text-brand-700">404</div>
      <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-stone-500">The page you are looking for does not exist or you do not have access to it.</p>
      <Link to="/dashboard" className="mt-6"><Button>Go to dashboard</Button></Link>
    </div>
  );
}
