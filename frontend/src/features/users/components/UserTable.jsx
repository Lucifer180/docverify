import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import { ROLE_LABELS } from '../../../constants/app.constants';
import { formatDate } from '../../../utils/formatDate';
import { ROLE_TONES } from '../user.utils';

export default function UserTable({ users, currentUserId, onEdit, onToggleActive }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-line bg-stone-50/60">
          <tr><th className="table-head">User</th><th className="table-head">Role</th><th className="table-head">Status</th><th className="table-head">Joined</th><th className="table-head" /></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="table-cell"><div className="font-medium">{u.name}{u.id === currentUserId && <span className="ml-1 text-xs text-stone-400">(you)</span>}</div><div className="text-xs text-stone-500">{u.email}</div></td>
              <td className="table-cell"><Badge tone={ROLE_TONES[u.role]}>{ROLE_LABELS[u.role]}</Badge></td>
              <td className="table-cell">{u.isActive ? <Badge tone="pass" dot>Active</Badge> : <Badge tone="fail" dot>Deactivated</Badge>}</td>
              <td className="table-cell text-stone-500">{formatDate(u.createdAt)}</td>
              <td className="table-cell text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onEdit(u)}>Edit</Button>
                  {u.id !== currentUserId && (
                    <Button size="sm" variant={u.isActive ? 'ghost' : 'secondary'} onClick={() => onToggleActive(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
