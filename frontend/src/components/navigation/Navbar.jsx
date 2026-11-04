import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Icon from '../common/Icon';
import Badge from '../common/Badge';
import { ROLE_LABELS } from '../../constants/app.constants';

export default function Navbar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} className="rounded-lg p-2 text-ink-800 hover:bg-stone-200/60 lg:hidden" aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium leading-tight">{user?.name}</div>
          <div className="text-xs text-stone-500">{user?.email}</div>
        </div>
        <Badge tone="brand" className="hidden sm:inline-flex">{ROLE_LABELS[user?.role]}</Badge>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">{initials}</div>
        <button type="button" title="Log out" aria-label="Log out"
          onClick={() => { logout(); navigate('/login'); }}
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-200/60 hover:text-ink-900">
          <Icon name="logout" />
        </button>
      </div>
    </header>
  );
}
