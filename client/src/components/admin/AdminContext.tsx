import { createContext, useContext } from 'react';

export interface AdminApi {
  /** Toast an error; signs out automatically when it is an auth failure. */
  reportError: (err: unknown, context?: string) => void;
  signOut: (reason?: string) => void;
}

export const AdminContext = createContext<AdminApi | null>(null);

export function useAdmin(): AdminApi {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside AdminContext');
  return ctx;
}

export function isAuthError(message: string): boolean {
  return /unauthori[sz]ed|invalid admin password|no admin password/i.test(message);
}
