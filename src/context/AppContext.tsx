import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { store } from '../data/store';
import type { User } from '../types';
import type { Company } from '../types';

type AppContextValue = {
  user: User | undefined;
  company: Company | undefined;
  setUser: (u: User | undefined) => void;
  refreshUser: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | undefined>(() => store.getCurrentUser());

  const setUser = useCallback((u: User | undefined) => {
    setUserState(u);
  }, []);

  const refreshUser = useCallback(() => {
    setUserState(store.getCurrentUser());
  }, []);

  const company = useMemo(() => {
    if (!user?.companyId) return undefined;
    return store.getCompany(user.companyId);
  }, [user?.companyId]);

  const value = useMemo(
    () => ({ user, company, setUser, refreshUser }),
    [user, company, setUser, refreshUser]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
