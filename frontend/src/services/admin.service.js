import api, { unwrap, unwrapList } from './api';

export const documentTypeService = {
  list: (all = false) => api.get('/document-types', { params: all ? { all: true } : {} }).then(unwrap),
  get: (key) => api.get(`/document-types/${key}`).then(unwrap),
  create: (data) => api.post('/document-types', data).then(unwrap),
  update: (key, data) => api.patch(`/document-types/${key}`, data).then(unwrap),
};

export const auditService = {
  list: (params) => api.get('/audit-logs', { params }).then(unwrapList),
};

export const systemService = {
  health: () => api.get('/health').then(unwrap),
};
