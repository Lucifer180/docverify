import { useState } from 'react';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import Alert from '../../../components/common/Alert';
import { errorMessage } from '../../../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

export function validateCase(v) {
  const e = {};
  if (v.title.trim().length < 3) e.title = 'Give the case a short title';
  if (v.applicantName.trim().length < 2) e.applicantName = 'Enter the applicant’s full name';
  if (v.applicantDob && v.applicantDob > today()) e.applicantDob = 'Date of birth cannot be in the future';
  return e;
}

/** Create / edit the case details that documents are compared against. */
export default function CaseForm({ initial, onSubmit, submitLabel = 'Save', onCancel }) {
  const [values, setValues] = useState({ title: '', applicantName: '', applicantDob: '', ...initial });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => { setValues((v) => ({ ...v, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateCase(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true); setFormError('');
    try {
      await onSubmit({ title: values.title.trim(), applicantName: values.applicantName.trim(), applicantDob: values.applicantDob || null });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <Input label="Case title" placeholder="e.g. B.Tech admission 2026" required value={values.title} onChange={set('title')} error={errors.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Applicant full name" required value={values.applicantName} onChange={set('applicantName')} error={errors.applicantName}
          hint="As it should appear on the documents" />
        <Input label="Date of birth" type="date" max={today()} value={values.applicantDob || ''} onChange={set('applicantDob')} error={errors.applicantDob}
          hint="Used to cross-check the documents" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
