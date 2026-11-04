import api, { unwrap } from './api';

export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }).then(unwrap),
  register: (data) => api.post('/auth/register', data).then(unwrap),
  me: () => api.get('/auth/me').then(unwrap),
  changePassword: (data) => api.post('/auth/change-password', data).then((r) => r.data),
};
