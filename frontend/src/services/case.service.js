import api, { unwrap, unwrapList } from './api';
import { API_URL } from '../constants/app.constants';

export const caseService = {
  dashboard: () => api.get('/cases/dashboard').then(unwrap),
  list: (params) => api.get('/cases', { params }).then(unwrapList),
  get: (id, { reveal = false } = {}) => api.get(`/cases/${id}`, { params: reveal ? { reveal: true } : {} }).then(unwrap),
  create: (data) => api.post('/cases', data).then(unwrap),
  update: (id, data) => api.patch(`/cases/${id}`, data).then(unwrap),
  submit: (id) => api.post(`/cases/${id}/submit`).then(unwrap),
  assign: (id, reviewerId) => api.post(`/cases/${id}/assign`, { reviewerId }).then(unwrap),
  decide: (id, decision, comment) => api.post(`/cases/${id}/decision`, { decision, comment }).then(unwrap),
  history: (id) => api.get(`/cases/${id}/history`).then(unwrap),
  upload: (id, files, onProgress) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.post(`/cases/${id}/documents`, form, {
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    }).then(unwrap);
  },
  /** Opens the report in a new tab (fetched with the auth header, then shown from a blob URL). */
  async openReport(id, format = 'html') {
    const res = await api.get(`/cases/${id}/report`, { params: { format }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    if (format === 'json') {
      const a = document.createElement('a');
      a.href = url; a.download = `verification-report-${id}.json`; a.click();
    } else {
      window.open(url, '_blank', 'noopener');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};

export const fileUrl = (path) => (path.startsWith('/api') ? `${API_URL.replace(/\/api$/, '')}${path}` : path);
