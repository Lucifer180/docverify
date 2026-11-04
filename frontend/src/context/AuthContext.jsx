import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth.service';
import { storage } from '../services/api';
import { TOKEN_KEY, USER_KEY } from '../constants/app.constants';

const AuthContext = createContext(null);

function readUser() {
  try { return JSON.parse(storage.get(USER_KEY) || 'null'); } catch { return null; }
}

/** Keeps the logged-in user and JWT (stored on this device in localStorage). */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [checking, setChecking] = useState(Boolean(storage.get(TOKEN_KEY)));

  const saveSession = useCallback(({ user: u, token }) => {
    storage.set(TOKEN_KEY, token);
    storage.set(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    storage.remove(TOKEN_KEY);
    storage.remove(USER_KEY);
    setUser(null);
  }, []);

  // Confirm the stored token is still valid when the app opens.
  useEffect(() => {
    if (!storage.get(TOKEN_KEY)) return;
    authService.me()
      .then((u) => { setUser(u); storage.set(USER_KEY, JSON.stringify(u)); })
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [logout]);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [logout]);

  const value = useMemo(() => ({
    user,
    checking,
    isAuthenticated: Boolean(user),
    hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
    login: async (email, password) => { const s = await authService.login(email, password); saveSession(s); return s.user; },
    register: async (data) => { const s = await authService.register(data); saveSession(s); return s.user; },
    logout,
  }), [user, checking, saveSession, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
