import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Loader from '../../components/common/Loader';
import Pagination from '../../components/common/Pagination';
import UserTable from '../../features/users/components/UserTable';
import UserFormModal from '../../features/users/components/UserFormModal';
import { useUsers } from '../../features/users/hooks/useUsers';
import { userService } from '../../services/user.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLE_LABELS } from '../../constants/app.constants';
import { errorMessage } from '../../utils/format';

export default function Users() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload, filters, update, setOffset } = useUsers();
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new user

  const toggle = async (u) => {
    try {
      await userService.update(u.id, { isActive: !u.isActive });
      toast.success(`${u.name} ${u.isActive ? 'deactivated' : 'activated'}`);
      reload({ silent: true });
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <>
      <PageHeader eyebrow="Administration" title="Users & roles" description="Self-registered users are submitters. Promote trusted staff to reviewer or administrator."
        actions={<Button icon={<Icon name="plus" size={16} />} onClick={() => setEditing(null)}>Add user</Button>} />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <input className="field max-w-xs" placeholder="Search name or email" value={filters.search} onChange={(e) => update({ search: e.target.value })} aria-label="Search users" />
          <select className="field w-auto" value={filters.role} onChange={(e) => update({ role: e.target.value })} aria-label="Role">
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {loading && !data ? <div className="p-10 text-center"><Loader /></div> : (
          <>
            <UserTable users={data.items} currentUserId={user.id} onEdit={setEditing} onToggleActive={toggle} />
            <Pagination total={data.total} limit={filters.limit} offset={filters.offset} onChange={setOffset} />
          </>
        )}
      </div>
      <UserFormModal open={editing !== undefined} user={editing} onClose={() => setEditing(undefined)}
        onSaved={(u) => { toast.success(`Saved ${u.name}`); setEditing(undefined); reload({ silent: true }); }} />
    </>
  );
}
