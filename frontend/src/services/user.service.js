import api, { unwrap, unwrapList } from './api';

export const userService = {
  list: (params) => api.get('/users', { params }).then(unwrapList),
  reviewers: () => api.get('/users/reviewers').then(unwrap),
  create: (data) => api.post('/users', data).then(unwrap),
  update: (id, data) => api.patch(`/users/${id}`, data).then(unwrap),
};
