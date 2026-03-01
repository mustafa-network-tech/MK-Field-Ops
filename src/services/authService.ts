import { store } from '../data/store';
import type { Role } from '../types';
import { supabase } from './supabaseClient';

function hashPassword(p: string): string {
  return btoa(encodeURIComponent(p));
}

function checkPassword(plain: string, hashed: string): boolean {
  return hashPassword(plain) === hashed;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

export type AuthResult = { ok: boolean; error?: string };

export const authService = {
  /** Login: uses Supabase Auth when configured, else local store. */
  async login(email: string, password: string, companyId?: string): Promise<AuthResult> {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login')) return { ok: false, error: 'auth.loginError' };
        return { ok: false, error: error.message };
      }
      const userId = data.user?.id;
      if (!userId) return { ok: false, error: 'auth.loginError' };
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, company_id, role, full_name, role_approval_status')
        .eq('id', userId)
        .single();
      if (profileError || !profile) return { ok: false, error: 'auth.loginError' };
      if (profile.role_approval_status !== 'approved') return { ok: false, error: 'auth.pendingApproval' };
      store.setUserFromProfile(profile, data.user?.email ?? email);
      return { ok: true };
    }
    const users = companyId ? store.getUsers(companyId) : store.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !checkPassword(password, user.passwordHash)) return { ok: false, error: 'auth.loginError' };
    if (user.roleApprovalStatus !== 'approved') return { ok: false, error: 'auth.pendingApproval' };
    store.setCurrentUserId(user.id);
    return { ok: true };
  },

  /** New company: creator becomes company manager. Uses Supabase Auth when configured. */
  async registerNewCompany(params: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
  }): Promise<AuthResult> {
    const { email, password, fullName, companyName } = params;
    const name = companyName.trim();

    const companies = store.getCompanies();
    const nameNorm = normalize(name);
    if (companies.some((c) => normalize(c.name) === nameNorm)) return { ok: false, error: 'auth.companyNameExists' };
    if (store.getUserByEmail(email)) return { ok: false, error: 'auth.emailExists' };

    if (supabase) {
      const company = store.addCompany(name);
      const cId = company.id;
      const { error: insertCompanyError } = await supabase.from('companies').insert({
        id: cId,
        name,
        language_code: 'en',
        created_at: new Date().toISOString(),
      });
      if (insertCompanyError) console.warn('Supabase companies insert', insertCompanyError);

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, company_id: cId, role: 'companyManager', role_approval_status: 'approved' } },
      });
      if (signUpError) {
        if (signUpError.message.includes('already registered')) return { ok: false, error: 'auth.emailExists' };
        return { ok: false, error: signUpError.message };
      }
      const userId = authData.user?.id;
      if (!userId) return { ok: false, error: 'auth.loginError' };
      if (authData.session) {
        const { data: profile } = await supabase.from('profiles').select('id, company_id, role, full_name, role_approval_status').eq('id', userId).single();
        if (profile) store.setUserFromProfile(profile, authData.user?.email ?? email);
      }
      return { ok: true };
    }

    const company = store.addCompany(name);
    const cId = company.id;
    store.addUser({
      companyId: cId,
      email,
      passwordHash: hashPassword(password),
      fullName,
      role: 'companyManager',
      roleApprovalStatus: 'approved',
    });
    const newUser = store.getUsers(cId).find((u) => u.email === email)!;
    store.setCurrentUserId(newUser.id);
    return { ok: true };
  },

  /** Existing company: user joins, pending until CM approves. Uses Supabase Auth when configured. */
  async registerExistingCompany(params: {
    email: string;
    password: string;
    fullName: string;
    companyId: string;
  }): Promise<AuthResult> {
    const { email, password, fullName, companyId } = params;
    const key = companyId.trim();

    let company = key ? store.getCompany(key) : undefined;
    if (!company && key) {
      const keyNorm = normalize(key);
      company = store.getCompanies().find(
        (c) => normalize(c.id) === keyNorm || normalize(c.name) === keyNorm || normalize(c.name).includes(keyNorm)
      ) ?? undefined;
    }

    if (supabase) {
      let cId: string;
      if (company) {
        cId = company.id;
      } else {
        const { data: rows } = await supabase.from('companies').select('id, name').or(`id.eq.${key},name.ilike.%${key}%`).limit(1);
        const row = rows?.[0];
        if (!row) return { ok: false, error: 'auth.companyNotFound' };
        cId = row.id;
        store.ensureCompany(row.id, row.name ?? '');
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, company_id: cId, role_approval_status: 'pending' } },
      });
      if (signUpError) {
        if (signUpError.message.includes('already registered')) return { ok: false, error: 'auth.emailExists' };
        return { ok: false, error: signUpError.message };
      }
      const userId = authData.user?.id;
      if (!userId) return { ok: false, error: 'auth.loginError' };
      if (authData.session) {
        const { data: profile } = await supabase.from('profiles').select('id, company_id, role, full_name, role_approval_status').eq('id', userId).single();
        if (profile) store.setUserFromProfile(profile, authData.user?.email ?? email);
      }
      return { ok: true };
    }

    if (!company) return { ok: false, error: 'auth.companyNotFound' };
    const cId = company.id;
    if (store.getUserByEmail(email, cId)) return { ok: false, error: 'auth.emailExists' };
    store.addUser({
      companyId: cId,
      email,
      passwordHash: hashPassword(password),
      fullName,
      role: undefined,
      roleApprovalStatus: 'pending',
    });
    return { ok: true };
  },

  logout(): void {
    supabase?.auth.signOut();
    store.setCurrentUserId(null);
  },

  /** Restore session from Supabase (call on app init). Returns user if session exists. */
  async restoreSession(): Promise<boolean> {
    if (!supabase) return false;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return false;
    const { data: profile } = await supabase.from('profiles').select('id, company_id, role, full_name, role_approval_status').eq('id', session.user.id).single();
    if (!profile) return false;
    store.setUserFromProfile(profile, session.user.email ?? '');
    return true;
  },

  approveUser(userId: string, assignedRole: Role): boolean {
    const user = store.getUsers().find((u) => u.id === userId);
    const currentUser = store.getCurrentUser();
    if (!user || user.roleApprovalStatus !== 'pending' || !currentUser || currentUser.role !== 'companyManager') return false;
    if (user.companyId !== currentUser.companyId) return false;
    store.updateUser(userId, { role: assignedRole, roleApprovalStatus: 'approved', approvedByCompanyManager: currentUser.id });
    if (supabase) supabase.from('profiles').update({ role: assignedRole, role_approval_status: 'approved' }).eq('id', userId).then((res: { error: Error | null }) => { if (res.error) console.warn(res.error); });
    return true;
  },

  rejectUser(userId: string): boolean {
    const updated = store.updateUser(userId, { roleApprovalStatus: 'rejected' });
    if (supabase) supabase.from('profiles').update({ role_approval_status: 'rejected' }).eq('id', userId).then(() => {});
    return updated != null;
  },
};
