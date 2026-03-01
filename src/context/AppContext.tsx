import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { store } from '../data/store';
import { fetchCompanyLanguageFromSupabase } from '../services/companyService';
import type { User } from '../types';
import type { Company } from '../types';

type AppContextValue = {
  user: User | undefined;
  company: Company | undefined;
  setUser: (u: User | undefined) => void;
  refreshUser: () => void;
  refreshCompany: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | undefined>(() => store.getCurrentUser());
  const [companyRefresh, setCompanyRefresh] = useState(0);

  const setUser = useCallback((u: User | undefined) => {
    setUserState(u);
  }, []);

  const refreshUser = useCallback(() => {
    setUserState(store.getCurrentUser());
  }, []);

  const refreshCompany = useCallback(() => {
    setCompanyRefresh((n) => n + 1);
  }, []);

  const company = useMemo(() => {
    if (!user?.companyId) return undefined;
    return store.getCompany(user.companyId);
  }, [user?.companyId, companyRefresh]);

  useEffect(() => {
    if (!user?.companyId) return;
    fetchCompanyLanguageFromSupabase(user.companyId).then(() => refreshCompany());
  }, [user?.companyId, refreshCompany]);

  const value = useMemo(
    () => ({ user, company, setUser, refreshUser, refreshCompany }),
    [user, company, setUser, refreshUser, refreshCompany]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
