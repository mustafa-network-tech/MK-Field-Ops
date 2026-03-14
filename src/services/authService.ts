import { store } from '../data/store';
import type { Role } from '../types';
import { canPlanAddUser } from './planGating';
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
    if (user.companyId) store.isolateTenantData(user.companyId);
    return { ok: true };
  },

  /** New company: creator becomes company manager. Requires join code (4 digits) and plan. */
  async registerNewCompany(params: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    joinCode: string;
    plan: 'starter' | 'professional' | 'enterprise';
    billingCycle?: 'monthly' | 'yearly';
  }): Promise<AuthResult> {
    const { email, password, fullName, companyName, joinCode, plan, billingCycle = 'monthly' } = params;
    const name = companyName.trim();
    const code = joinCode.trim();
    if (!/^\d{4}$/.test(code)) return { ok: false, error: 'auth.joinCodeInvalid' };

    const companies = store.getCompanies();
    const nameNorm = normalize(name);
    if (!supabase && companies.some((c) => normalize(c.name) === nameNorm)) return { ok: false, error: 'auth.companyNameExists' };
    if (store.getUserByEmail(email)) return { ok: false, error: 'auth.emailExists' };

    if (supabase) {
      const cId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      const { data: insertedCompany, error: insertCompanyError } = await supabase
        .from('companies')
        .insert({
          id: cId,
          name,
          join_code: code,
          plan,
          billing_cycle: billingCycle,
          plan_status: 'trial',
          trial_end_date: trialEnd.toISOString().slice(0, 10),
          language_code: 'en',
          created_at: new Date().toISOString(),
        })
        .select('id, name')
        .single();
      if (insertCompanyError) {
        console.error('[Supabase] companies INSERT failed:', {
          code: insertCompanyError.code,
          message: insertCompanyError.message,
          details: insertCompanyError.details,
          hint: insertCompanyError.hint,
        });
        if (insertCompanyError.code === '23505') return { ok: false, error: 'auth.companyNameExists' };
        return { ok: false, error: insertCompanyError.message };
      }
      if (!insertedCompany) return { ok: false, error: 'auth.loginError' };
      const planStart = new Date().toISOString();
      const planEndDate = new Date();
      if (billingCycle === 'yearly') planEndDate.setFullYear(planEndDate.getFullYear() + 1);
      else planEndDate.setMonth(planEndDate.getMonth() + 1);
      const planEnd = planEndDate.toISOString();
      store.ensureCompany(insertedCompany.id, insertedCompany.name);
      store.updateCompany(insertedCompany.id, { plan, plan_start_date: planStart, plan_end_date: planEnd }, insertedCompany.id);

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, company_id: insertedCompany.id, role: 'companyManager', role_approval_status: 'approved' } },
      });
      if (signUpError) {
        if (signUpError.message.includes('already registered')) return { ok: false, error: 'auth.emailExists' };
        return { ok: false, error: signUpError.message };
      }
      const userId = authData.user?.id;
      if (!userId) return { ok: false, error: 'auth.loginError' };
      await supabase.from('companies').update({ owner_user_id: userId }).eq('id', insertedCompany.id);
      if (authData.session) {
        const { data: profile } = await supabase.from('profiles').select('id, company_id, role, full_name, role_approval_status').eq('id', userId).single();
        if (profile) store.setUserFromProfile(profile, authData.user?.email ?? email);
      }
      return { ok: true };
    }

    const company = store.addCompany(name);
    const cId = company.id;
    const planStart = new Date().toISOString();
    const planEndDate = new Date();
    if (billingCycle === 'yearly') planEndDate.setFullYear(planEndDate.getFullYear() + 1);
    else planEndDate.setMonth(planEndDate.getMonth() + 1);
    store.updateCompany(cId, { plan, plan_start_date: planStart, plan_end_date: planEndDate.toISOString() }, cId);
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

  /** Existing company: verify by company name + join code, create join request (pending). User not added until CM approves. */
  async registerExistingCompany(params: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    joinCode: string;
  }): Promise<AuthResult> {
    const { email, password, fullName, companyName, joinCode } = params;
    const name = companyName.trim();
    const code = joinCode.trim();
    if (!/^\d{4}$/.test(code)) return { ok: false, error: 'auth.joinCodeInvalid' };

    if (supabase) {
      const { data: cId, error: rpcError } = await supabase.rpc('get_company_id_by_join', {
        p_company_name: name,
        p_join_code: code,
      });
      if (rpcError || cId == null) return { ok: false, error: 'auth.companyNotFound' };

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            join_company_id: cId,
            role_approval_status: 'pending',
          },
        },
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

    const companies = store.getCompanies();
    const company = companies.find((c) => normalize(c.name) === normalize(name) && (c as { join_code?: string }).join_code === code);
    if (!company) return { ok: false, error: 'auth.companyNotFound' };
    const cId = company.id;
    if (store.getUserByEmail(email, cId)) return { ok: false, error: 'auth.emailExists' };
    const existingUsers = store.getUsers(cId);
    const companyWithPlan = store.getCompany(cId, cId);
    if (!canPlanAddUser(companyWithPlan?.plan, existingUsers.length)) {
      return { ok: false, error: 'onboarding.userLimitReached' };
    }
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
    const { data: profile } = await supabase.from('profiles').select('id, company_id, role, full_name, role_approval_status, email').eq('id', session.user.id).single();
    if (!profile) return false;
    store.setUserFromProfile(profile, profile.email ?? session.user.email ?? '');
    return true;
  },

  /** Fetch profiles for company from Supabase (CM/PM only by RLS). Merge into store so pending users appear. */
  async fetchCompanyProfilesIntoStore(companyId: string): Promise<void> {
    if (!supabase) return;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, company_id, role, full_name, role_approval_status, email')
      .eq('company_id', companyId);
    if (!profiles) return;
    profiles.forEach((p) => store.mergeUserFromProfile(p, p.email ?? ''));
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

  /** Fetch pending join requests for current company (CM/PM). */
  async fetchJoinRequests(companyId: string): Promise<{ id: string; user_id: string; company_id: string; status: string; created_at: string }[]> {
    if (!supabase) return [];
    const { data } = await supabase.from('join_requests').select('id, user_id, company_id, status, created_at').eq('company_id', companyId).eq('status', 'pending');
    return data ?? [];
  },

  /** Fetch pending join requests with user full_name and email (for CM approval UI). */
  async fetchJoinRequestsWithProfiles(companyId: string): Promise<{ id: string; user_id: string; full_name: string | null; email: string | null }[]> {
    if (!supabase) return [];
    const requests = await this.fetchJoinRequests(companyId);
    if (requests.length === 0) return [];
    const userIds = requests.map((r) => r.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return requests.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      full_name: profileMap.get(r.user_id)?.full_name ?? null,
      email: profileMap.get(r.user_id)?.email ?? null,
    }));
  },

  /** Approve a join request: attach user to company and set role. CM only. */
  async approveJoinRequest(requestId: string, assignedRole: Role): Promise<boolean> {
    if (!supabase) return false;
    const { data, error } = await supabase.rpc('approve_join_request', { req_id: requestId, assigned_role: assignedRole });
    if (error) return false;
    return data === true;
  },

  /** Reject a join request. CM only. */
  async rejectJoinRequest(requestId: string): Promise<boolean> {
    if (!supabase) return false;
    const { data, error } = await supabase.rpc('reject_join_request', { req_id: requestId });
    if (error) return false;
    return data === true;
  },

  /** Request password reset email (Supabase only). Returns ok: false with error key if Supabase not configured or request failed. */
  async requestPasswordReset(email: string): Promise<AuthResult> {
    if (!supabase) return { ok: false, error: 'auth.forgotPasswordNotConfigured' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },
};
