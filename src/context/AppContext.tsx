import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { store } from '../data/store';
import { authService } from '../services/authService';
import { ensurePendingUserNotifications } from '../services/activityNotificationService';
import { fetchCompanyLanguageFromSupabase } from '../services/companyService';
import type { User } from '../types';
import type { Company } from '../types';

type AppContextValue = {
  user: User | undefined;
  company: Company | undefined;
  setUser: (u: User | undefined) => void;
  refreshUser: () => void;
  refreshCompany: () => void;
  /** Bumped after company profiles (incl. pending users) are loaded so approval count/UI updates. */
  profilesVersion: number;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | undefined>(() => store.getCurrentUser());
  const [companyRefresh, setCompanyRefresh] = useState(0);
  const [profilesVersion, setProfilesVersion] = useState(0);

  useEffect(() => {
    authService.restoreSession().then((restored) => {
      if (restored) setUserState(store.getCurrentUser());
    });
  }, []);

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
    return store.getCompany(user.companyId, user.companyId);
  }, [user?.companyId, companyRefresh]);

  useEffect(() => {
    if (!user?.companyId) return;
    fetchCompanyLanguageFromSupabase(user.companyId).then(() => refreshCompany());
  }, [user?.companyId, refreshCompany]);

  // Load company profiles (including pending users) for CM/PM so dashboard approval count and notifications work
  useEffect(() => {
    if (!user?.companyId || (user.role !== 'companyManager' && user.role !== 'projectManager')) return;
    authService.fetchCompanyProfilesIntoStore(user.companyId).then(() => {
      const pending = store.getUsers(user.companyId).filter((u) => u.roleApprovalStatus === 'pending');
      ensurePendingUserNotifications(user.companyId, pending.map((u) => ({ id: u.id, fullName: u.fullName ?? null })));
      setProfilesVersion((v) => v + 1);
    });
  }, [user?.companyId, user?.role]);

  const value = useMemo(
    () => ({ user, company, setUser, refreshUser, refreshCompany, profilesVersion }),
    [user, company, setUser, refreshUser, refreshCompany, profilesVersion]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
