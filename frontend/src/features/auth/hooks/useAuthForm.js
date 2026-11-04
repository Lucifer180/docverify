import { useState } from 'react';
import { errorMessage } from '../../../utils/format';

/** Small form helper for the auth screens: values, field errors, submit state. */
export function useAuthForm(initial, validate, onSubmit) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const bind = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (e) => { setValues((v) => ({ ...v, [name]: e.target.value })); setErrors((er) => ({ ...er, [name]: undefined })); },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(errorMessage(err, 'Could not sign in'));
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, bind, handleSubmit, formError, submitting };
}
