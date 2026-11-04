import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Icon from '../common/Icon';
import { APP_NAME, ROLE_LABELS } from '../../constants/app.constants';
import { cx } from '../../utils/format';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/cases', label: 'Cases', icon: 'folder', end: true },
  { to: '/cases/new', label: 'New case', icon: 'plus', roles: ['submitter', 'admin'] },
  { section: 'Administration', roles: ['admin'] },
  { to: '/admin/users', label: 'Users & roles', icon: 'users', roles: ['admin'] },
  { to: '/admin/document-types', label: 'Document types & rules', icon: 'settings', roles: ['admin'] },
  { to: '/admin/audit', label: 'Audit log', icon: 'audit', roles: ['admin'] },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const visible = LINKS.filter((l) => !l.roles || l.roles.includes(user?.role));

  return (
    <>
      <div className={cx('fixed inset-0 z-30 bg-ink-950/40 lg:hidden', open ? 'block' : 'hidden')} onClick={onClose} aria-hidden="true" />
      <aside className={cx(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink-950 text-stone-300 transition-transform lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center gap-2.5 px-5">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <div>
            <div className="text-[15px] font-semibold text-white">{APP_NAME}</div>
            <div className="text-[11px] text-stone-400">Document verification</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {visible.map((l) => (l.section ? (
            <div key={l.section} className="px-3 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">{l.section}</div>
          ) : (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={onClose}
              className={({ isActive }) => cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                isActive ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white',
              )}>
              <Icon name={l.icon} />
              {l.label}
            </NavLink>
          )))}
        </nav>
        <div className="m-3 rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-stone-400">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-stone-200"><Icon name="shield" size={14} /> Preliminary checks</div>
          Automated results flag inconsistencies only. They do not prove a document is genuine.
        </div>
        <div className="border-t border-white/10 px-5 py-3 text-xs text-stone-400">
          Signed in as <span className="text-stone-200">{ROLE_LABELS[user?.role]}</span>
        </div>
      </aside>
    </>
  );
}
