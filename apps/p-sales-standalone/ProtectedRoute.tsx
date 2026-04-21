import React from 'react';
import { useAuth } from './useAuth.js';
import { LoginPage } from './LoginPage.js';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
}
