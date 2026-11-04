import { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import Input, { Select } from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Alert from '../../../components/common/Alert';
import { ROLE_LABELS } from '../../../constants/app.constants';
import { userService } from '../../../services/user.service';
import { errorMessage } from '../../../utils/format';
import { validateUser } from '../user.utils';

export default function UserFormModal({ open, user, onClose, onSaved }) {
  const creating = !user;
  const [v, setV] = useState({ name: '', email: '', password: '', role: 'reviewer' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setV(user ? { name: user.name, email: user.email, password: '', role: user.role } : { name: '', email: '', password: '', role: 'reviewer' });
      setErrors({}); setFormError('');
    }
  }, [open, user]);

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    const found = validateUser(v, { creating });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true); setFormError('');
    try {
      const saved = creating
        ? await userService.create({ name: v.name.trim(), email: v.email.trim(), password: v.password, role: v.role })
        : await userService.update(user.id, { name: v.name.trim(), role: v.role });
      onSaved(saved);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={creating ? 'Add user' : 'Edit user'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={saving} onClick={save}>{creating ? 'Create user' : 'Save'}</Button></>}>
      <div className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Input label="Name" value={v.name} onChange={set('name')} error={errors.name} required />
        <Input label="Email" type="email" value={v.email} onChange={set('email')} error={errors.email} disabled={!creating} required />
        {creating && <Input label="Temporary password" type="text" value={v.password} onChange={set('password')} error={errors.password} required
          hint="Share it securely; the user can change it later." />}
        <Select label="Role" value={v.role} onChange={set('role')}>
          {Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>
    </Modal>
  );
}
