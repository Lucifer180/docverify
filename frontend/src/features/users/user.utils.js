export const ROLE_TONES = { admin: 'brand', reviewer: 'info', submitter: 'neutral' };

export function validateUser(v, { creating }) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Enter a name';
  if (creating && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = 'Enter a valid email';
  if (creating && (v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/\d/.test(v.password))) {
    e.password = 'At least 8 characters with letters and numbers';
  }
  return e;
}
