import api, { unwrap } from './api';

export const documentService = {
  fileLink: (id) => api.get(`/documents/${id}/file-link`).then(unwrap),
  versions: (id, reveal = false) => api.get(`/documents/${id}/versions`, { params: reveal ? { reveal: true } : {} }).then(unwrap),
  rawText: (id) => api.get(`/documents/${id}/text`).then(unwrap),
  correct: (id, data) => api.put(`/documents/${id}/fields`, data).then(unwrap),
  reprocess: (id, fromScratch = false) => api.post(`/documents/${id}/reprocess`, { fromScratch }).then(unwrap),
  remove: (id) => api.delete(`/documents/${id}`).then((r) => r.data),
};
