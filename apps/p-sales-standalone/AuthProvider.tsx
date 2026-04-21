import React, { createContext, useState, useCallback, useEffect } from 'react';

export interface AuthUser {
  email: string;
  role: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'psales_token';
const API_BASE = '/api/psales/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then((data: { valid: boolean; email?: string; role?: string }) => {
        if (data.valid && data.email && data.role) {
          setUser({ email: data.email, role: data.role });
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => sessionStorage.removeItem(TOKEN_KEY));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; email?: string; role?: string; error?: string };
      if (!res.ok) return { ok: false, error: data.error ?? 'Bejelentkezés sikertelen' };
      sessionStorage.setItem(TOKEN_KEY, data.token!);
      setUser({ email: data.email!, role: data.role! });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Hálózati hiba' };
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
