import axios from 'axios';
import { API_URL, TOKEN_KEY } from '../constants/app.constants';

/** Shared axios instance: adds the JWT and signals the app when the session expires. */
const api = axios.create({ baseURL: API_URL, timeout: 60000 });

export const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } },
};

api.interceptors.request.use((config) => {
  const token = storage.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/login');
    if (err.response?.status === 401 && !isAuthCall) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(err);
  },
);

/** Unwraps { success, data, meta } responses. */
export const unwrap = (res) => res.data.data;
export const unwrapList = (res) => ({ items: res.data.data, total: res.data.meta?.total ?? res.data.data.length });

export default api;
