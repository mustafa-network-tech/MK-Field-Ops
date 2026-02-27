import { store } from '../data/store';
import type { Role } from '../types';
import { supabase } from './supabaseClient';

function hashPassword(p: string): string {
  return btoa(encodeURIComponent(p));
}

function checkPassword(plain: string, hashed: string): boolean {
  return hashPassword(plain) === hashed;
}

export const authService = {
  login(email: string, password: string, companyId?: string): { ok: boolean; error?: string } {
    const users = companyId ? store.getUsers(companyId) : store.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !checkPassword(password, user.passwordHash)) {
      return { ok: false, error: 'auth.loginError' };
    }
    if (user.roleApprovalStatus !== 'approved') {
      return { ok: false, error: 'auth.pendingApproval' };
    }
    store.setCurrentUserId(user.id);
    return { ok: true };
  },

  /** New company: creator becomes company manager, no role asked. */
  registerNewCompany(params: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
  }): { ok: boolean; error?: string } {
    const { email, password, fullName, companyName } = params;
    const name = companyName.trim();

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');

    // 1) Şirket adı benzersiz olmalı (global)
    const companies = store.getCompanies();
    const nameNorm = normalize(name);
    if (companies.some((c) => normalize(c.name) === nameNorm)) {
      return { ok: false, error: 'auth.companyNameExists' };
    }

    // 2) Bir hesap sadece bir şirket sahibi olabilir (email global benzersiz)
    if (store.getUserByEmail(email)) {
      return { ok: false, error: 'auth.emailExists' };
    }

    const company = store.addCompany(name);
    const cId = company.id;

    // Supabase'e de yaz (isteğe bağlı, hata verse bile localStorage çalışmaya devam eder)
    if (supabase) {
      supabase
        .from('companies')
        .insert({
          id: cId,
          name,
          created_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) {
            // Tarayıcı konsolunda görebilmen için logluyoruz
            console.error('Supabase companies insert error', error);
          }
        });
    }

    store.addUser({
      companyId: cId,
      email,
      passwordHash: hashPassword(password),
      fullName,
      role: 'companyManager',
      roleApprovalStatus: 'approved',
      createdAt: new Date().toISOString(),
    });
    const newUser = store.getUsers(cId).find((u) => u.email === email)!;
    store.setCurrentUserId(newUser.id);
    return { ok: true };
  },

  /** Existing company: user enters company ID, pending until company manager approves and assigns role. */
  registerExistingCompany(params: {
    email: string;
    password: string;
    fullName: string;
    companyId: string;
  }): { ok: boolean; error?: string } {
    const { email, password, fullName, companyId } = params;
    const key = companyId.trim();

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');

    // First try by exact ID
    let company = key ? store.getCompany(key) : undefined;

    const companies = store.getCompanies();
    if (!company && key) {
      const keyNorm = normalize(key);
      company = companies.find((c) => {
        const nameNorm = normalize(c.name);
        const idNorm = normalize(c.id);
        return idNorm === keyNorm || nameNorm === keyNorm || nameNorm.includes(keyNorm);
      });
    }
    if (!company) {
      return { ok: false, error: 'auth.companyNotFound' };
    }

    const cId = company.id;
    if (store.getUserByEmail(email, cId)) {
      return { ok: false, error: 'auth.emailExists' };
    }

    // Supabase'e de yaz
    if (supabase) {
      supabase
        .from('users')
        .insert({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          company_id: cId,
          email,
          full_name: fullName,
          role: null,
          role_approval_status: 'pending',
          created_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) {
            console.error('Supabase users insert error', error);
          }
        });
    }

    store.addUser({
      companyId: cId,
      email,
      passwordHash: hashPassword(password),
      fullName,
      role: undefined,
      roleApprovalStatus: 'pending',
      createdAt: new Date().toISOString(),
    });
    return { ok: true };
  },

  logout(): void {
    store.setCurrentUserId(null);
  },

  /** Company manager approves pending user and assigns role. Role is required. */
  approveUser(userId: string, assignedRole: Role): boolean {
    const user = store.getUsers().find((u) => u.id === userId);
    const currentUser = store.getCurrentUser();
    if (!user || user.roleApprovalStatus !== 'pending' || !currentUser || currentUser.role !== 'companyManager') return false;
    if (user.companyId !== currentUser.companyId) return false;
    store.updateUser(userId, {
      role: assignedRole,
      roleApprovalStatus: 'approved',
      approvedByCompanyManager: currentUser.id,
    });
    return true;
  },

  rejectUser(userId: string): boolean {
    return store.updateUser(userId, { roleApprovalStatus: 'rejected' }) != null;
  },
};
