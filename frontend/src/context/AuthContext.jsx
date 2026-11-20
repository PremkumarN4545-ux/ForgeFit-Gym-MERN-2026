import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { getToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // If a token exists we must verify it with the server before deciding what to render.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return undefined;
    }
    let ignore = false;
    authService
      .me()
      .then((account) => !ignore && setUser(account))
      .catch(() => {}) // a 401 already cleared the token in the axios interceptor
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, []);

  // Fired by the axios interceptor when the API rejects the token.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('forgefit:unauthorized', onUnauthorized);
    return () => window.removeEventListener('forgefit:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const admin = await authService.login(email, password);
    setUser(admin);
    return admin;
  }, []);

  const loginMember = useCallback(async (email, password) => {
    const member = await authService.loginMember(email, password);
    setUser(member);
    return member;
  }, []);

  const registerMember = useCallback((details) => authService.registerMember(details), []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, loginMember, registerMember, logout }),
    [user, loading, login, loginMember, registerMember, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
