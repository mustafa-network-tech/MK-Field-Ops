import { store } from '../data/store';
import type { Role } from '../types';
import { canPlanAddUser } from './planGating';
import { getEffectivePlan } from './subscriptionService';
import { supabase } from './supabaseClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

function hashPassword(p: string): string {
  return btoa(encodeURIComponent(p));
}

function checkPassword(plain: string, hashed: string): boolean {
  return hashPassword(plain) === hashed;
}

function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

function getSupabaseProjectRef(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!raw) return 'unknown';
  return raw.replace(/^https:\/\//, '').replace(/\.supabase\.co.*/, '');
}

function buildProfileFromAuthUser(user: SupabaseUser, fallbackEmail: string) {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const role = typeof meta.role === 'string' ? meta.role : null;
  const roleApprovalStatus =
    typeof meta.role_approval_status === 'string'
      ? meta.role_approval_status
      : role === 'superAdmin'
        ? 'approved'
        : 'approved';
  return {
    id: user.id,
    company_id: role === 'superAdmin' ? '' : typeof meta.company_id === 'string' ? meta.company_id : '',
    role,
    full_name: typeof meta.full_name === 'string' ? meta.full_name : null,
    role_approval_status: roleApprovalStatus,
    can_see_prices: null,
    email: user.email ?? fallbackEmail,
  };
}

function normalizeSessionProfile<T extends { role: string | null; company_id: string | null; role_approval_status: string }>(profile: T): T {
  if (profile.role === 'superAdmin') {
    return {
      ...profile,
      company_id: null,
      role_approval_status: 'approved',
    };
  }
  return profile;
}

async function fetchOrRepairProfile(user: SupabaseUser, fallbackEmail: string) {
  if (!supabase) return null;
  const profileSelect = 'id, company_id, role, full_name, role_approval_status, can_see_prices, email';
  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .maybeSingle();
  if (!existingError && existing) return existing;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const role = typeof meta.role === 'string' ? meta.role : null;
  const companyId = role === 'superAdmin' ? null : typeof meta.company_id === 'string' ? meta.company_id : null;
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : null;
  const roleApprovalStatus =
    typeof meta.role_approval_status === 'string'
      ? meta.role_approval_status
      : role === 'superAdmin'
        ? 'approved'
        : 'pending';

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      company_id: companyId,
      role,
      full_name: fullName,
      role_approval_status: roleApprovalStatus,
      email: user.email ?? fallbackEmail,
    },
    { onConflict: 'id' }
  );

  const { data: repaired, error: repairedError } = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .maybeSingle();
  if (repairedError || !repaired) return null;
  return normalizeSessionProfile(repaired);
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
    const normalizedEmail = normalizeEmailInput(email);
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        if (error.message.includes('Invalid login')) {
          return {
            ok: false,
            error: `Giris reddedildi (invalid login). Supabase proje ref: ${getSupabaseProjectRef()}`,
          };
        }
        return { ok: false, error: error.message };
      }
      const signedUser = data.user;
      const userId = signedUser?.id;
      if (!userId) return { ok: false, error: 'auth.loginError' };
      const profile = await fetchOrRepairProfile(signedUser, normalizedEmail);
      if (!profile) {
        const profileFromMeta = buildProfileFromAuthUser(signedUser, normalizedEmail);
        store.setUserFromProfile(profileFromMeta, signedUser?.email ?? normalizedEmail);
        return { ok: true };
      }
      if (profile.role !== 'superAdmin' && profile.role_approval_status !== 'approved') return { ok: false, error: 'auth.pendingApproval' };
      store.setUserFromProfile(profile, signedUser?.email ?? normalizedEmail);
      const { fetchCompanyDataFromSupabase } = await import('./supabaseSyncService');
      await fetchCompanyDataFromSupabase(profile.company_id ?? '');
      return { ok: true };
    }
    const users = companyId ? store.getUsers(companyId) : store.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
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
    const normalizedEmail = normalizeEmailInput(email);
    const name = companyName.trim();
    const code = joinCode.trim();
    if (!/^\d{4}$/.test(code)) return { ok: false, error: 'auth.joinCodeInvalid' };

    const companies = store.getCompanies();
    const nameNorm = normalize(name);
    if (!supabase && companies.some((c) => normalize(c.name) === nameNorm)) return { ok: false, error: 'auth.companyNameExists' };
    if (store.getUserByEmail(normalizedEmail)) return { ok: false, error: 'auth.emailExists' };

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
      else planEndDate.setDate(planEndDate.getDate() + 30);
      const planEnd = planEndDate.toISOString();
      store.ensureCompany(insertedCompany.id, insertedCompany.name);
      store.updateCompany(insertedCompany.id, { plan, plan_start_date: planStart, plan_end_date: planEnd }, insertedCompany.id);
      if (plan === 'starter') store.ensureStarterDefaultProject(insertedCompany.id, plan);

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
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
        if (profile) store.setUserFromProfile(profile, authData.user?.email ?? normalizedEmail);
      }
      return { ok: true };
    }

    const company = store.addCompany(name);
    const cId = company.id;
    const planStart = new Date().toISOString();
    const planEndDate = new Date();
    if (billingCycle === 'yearly') planEndDate.setFullYear(planEndDate.getFullYear() + 1);
    else planEndDate.setDate(planEndDate.getDate() + 30);
    store.updateCompany(cId, { plan, plan_start_date: planStart, plan_end_date: planEndDate.toISOString() }, cId);
    if (plan === 'starter') store.ensureStarterDefaultProject(cId, plan);
    store.addUser({
      companyId: cId,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      fullName,
      role: 'companyManager',
      roleApprovalStatus: 'approved',
    });
    const newUser = store.getUsers(cId).find((u) => u.email === normalizedEmail)!;
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
    const normalizedEmail = normalizeEmailInput(email);
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
        email: normalizedEmail,
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
        const { data: profile } = await supabase.from('profiles').select('id, company_id, role, full_name, role_approval_status, can_see_prices').eq('id', userId).single();
        if (profile) store.setUserFromProfile(profile, authData.user?.email ?? normalizedEmail);
      }
      return { ok: true };
    }

    const companies = store.getCompanies();
    const company = companies.find((c) => normalize(c.name) === normalize(name) && (c as { join_code?: string }).join_code === code);
    if (!company) return { ok: false, error: 'auth.companyNotFound' };
    const cId = company.id;
    if (store.getUserByEmail(normalizedEmail, cId)) return { ok: false, error: 'auth.emailExists' };
    const existingUsers = store.getUsers(cId);
    const companyWithPlan = store.getCompany(cId, cId);
    if (!canPlanAddUser(getEffectivePlan(companyWithPlan), existingUsers.length)) {
      return { ok: false, error: 'onboarding.userLimitReached' };
    }
    store.addUser({
      companyId: cId,
      email: normalizedEmail,
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
    const { data: profile } = await supabase.from('profiles').select('id, company_id, role, full_name, role_approval_status, email, can_see_prices').eq('id', session.user.id).single();
    if (!profile) return false;
    store.setUserFromProfile(profile, profile.email ?? session.user.email ?? '');
    const { fetchCompanyDataFromSupabase } = await import('./supabaseSyncService');
    if (profile.company_id) await fetchCompanyDataFromSupabase(profile.company_id);
    return true;
  },

  /** Fetch profiles for company from Supabase (CM/PM only by RLS). Merge into store so pending users appear. */
  async fetchCompanyProfilesIntoStore(companyId: string): Promise<void> {
    if (!supabase) return;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, company_id, role, full_name, role_approval_status, email, can_see_prices')
      .eq('company_id', companyId);
    if (!profiles) return;
    profiles.forEach((p) => store.mergeUserFromProfile(p, p.email ?? ''));
  },

  /** Update can_see_prices for a user (CM only). Persists to Supabase when configured; always updates local store. */
  async updateUserCanSeePrices(userId: string, canSeePrices: boolean): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('profiles').update({ can_see_prices: canSeePrices }).eq('id', userId);
      if (error) {
        console.warn('[Supabase] profiles can_see_prices update failed:', error);
        return false;
      }
    }
    return true;
  },

  approveUser(userId: string, assignedRole: Role): boolean {
    const user = store.getUsers().find((u) => u.id === userId);
    const currentUser = store.getCurrentUser();
    if (!user || user.roleApprovalStatus !== 'pending' || !currentUser || currentUser.role !== 'companyManager') return false;
    if (user.companyId !== currentUser.companyId) return false;
    if (assignedRole === 'companyManager') {
      const existingCM = store.getUsers(user.companyId).find((u) => u.role === 'companyManager' && u.id !== userId);
      if (existingCM) return false;
    }
    store.updateUser(userId, { role: assignedRole, roleApprovalStatus: 'approved', approvedByCompanyManager: currentUser.id });
    if (supabase) supabase.from('profiles').update({ role: assignedRole, role_approval_status: 'approved' }).eq('id', userId).then((res: { error: Error | null }) => { if (res.error) console.warn(res.error); });
    return true;
  },

  rejectUser(userId: string): boolean {
    const updated = store.updateUser(userId, { roleApprovalStatus: 'rejected' });
    if (supabase) supabase.from('profiles').update({ role_approval_status: 'rejected' }).eq('id', userId).then(() => {});
    return updated != null;
  },

  /**
   * Kullanıcıyı şirketten çıkar: hesap silinmez; tekrar katılım kodu ile başvurabilir.
   * CM/PM. Son şirket yöneticisi çıkarılamaz. Kendi kendini çıkarmaya izin verilmez.
   */
  async removeUserFromCompany(
    targetUserId: string,
    actingUser: { id: string; companyId: string; role?: string }
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!actingUser.companyId) return { ok: false, error: 'users.removeFromCompanyForbidden' };
    if (actingUser.role !== 'companyManager' && actingUser.role !== 'projectManager') {
      return { ok: false, error: 'users.removeFromCompanyForbidden' };
    }
    if (targetUserId === actingUser.id) {
      return { ok: false, error: 'users.cannotRemoveSelf' };
    }
    const inCompany = store.getUsers(actingUser.companyId).find((u) => u.id === targetUserId);
    if (!inCompany) return { ok: false, error: 'users.userNotInCompany' };

    if (inCompany.role === 'companyManager' && inCompany.roleApprovalStatus === 'approved') {
      const cms = store.getUsers(actingUser.companyId).filter(
        (u) => u.role === 'companyManager' && u.roleApprovalStatus === 'approved'
      );
      if (cms.length <= 1) {
        return { ok: false, error: 'users.cannotRemoveLastCompanyManager' };
      }
    }

    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({
          company_id: null,
          role: null,
          role_approval_status: 'rejected',
        })
        .eq('id', targetUserId)
        .eq('company_id', actingUser.companyId);
      if (error) {
        console.warn('[removeUserFromCompany]', error);
        return { ok: false, error: error.message };
      }
    }

    const { upsertTeam } = await import('./supabaseSyncService');
    for (const t of store.getTeams(actingUser.companyId)) {
      if (t.wipedAt) continue;
      const patch: Partial<import('../types').Team> = {};
      if (t.leaderId === targetUserId) patch.leaderId = undefined;
      if (t.memberIds?.includes(targetUserId)) {
        patch.memberIds = t.memberIds.filter((id) => id !== targetUserId);
      }
      if (Object.keys(patch).length) {
        const updated = store.updateTeam(t.id, patch);
        if (updated) void upsertTeam(updated).catch(() => {});
      }
    }

    store.detachUserFromCompany(targetUserId, actingUser.companyId);
    return { ok: true };
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
