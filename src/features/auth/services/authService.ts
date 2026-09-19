import { store } from '@/lib/storage/store';
import type { Role, User } from '@/shared/types';
import { supabase } from '@/lib/supabase/supabaseClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

/** Oturum metadata’sındaki şirket adı (store henüz dolmamışken üst çubuk için yedek). */
export function getCompanyNameFromUserMetadata(user: SupabaseUser | null | undefined): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const raw = typeof meta.company_name === 'string' ? meta.company_name.trim() : '';
  return raw || null;
}

type Profile = {
  id: string; company_id: string | null; role: string | null;
  full_name: string | null; role_approval_status: string;
  can_see_prices?: boolean | null; email?: string | null;
};

// Only a successfully authenticated identity and its DB row may establish authority.
export function isApprovedProfile(profile: Profile | null, userId: string): profile is Profile {
  if (!profile || profile.id !== userId || profile.role_approval_status !== 'approved') return false;
  if (profile.role === 'superAdmin') return profile.company_id === null;
  if (profile.role === null) return profile.company_id === null; // Detached user: PendingJoin only.
  return ['companyManager', 'projectManager', 'teamLeader'].includes(profile.role)
    && typeof profile.company_id === 'string' && profile.company_id.trim().length > 0;
}

let verifiedUser: User | undefined;
let sessionVersion = 0;
const sessionListeners = new Set<() => void>();
function notifySession() { sessionListeners.forEach(listener => listener()); }
function clearSession() {
  sessionVersion += 1;
  verifiedUser = undefined;
  store.clearAuthCache();
  notifySession();
}
async function rejectSession(version: number) {
  if (version !== sessionVersion) return;
  clearSession();
  try { await supabase?.auth.signOut({ scope: 'local' }); } catch { /* Already fail closed locally. */ }
}
async function readProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles')
    .select('id, company_id, role, full_name, role_approval_status, can_see_prices, email')
    .eq('id', userId).maybeSingle();
  return error ? null : data;
}
function acceptProfile(profile: Profile, email: string) {
  // Never inherit cached permission flags or credentials from a previous session.
  const user = store.setUserFromProfile({ ...profile, company_id: profile.company_id ?? '',
    can_see_prices: profile.can_see_prices === true }, email);
  verifiedUser = { ...user };
  notifySession();
}

export type AuthResult = { ok: boolean; error?: string };

/** UI için: servis/DB ham hatalarını i18n anahtarına normalize et. */
export function toAuthErrorKey(error?: string): string {
  if (!error) return 'auth.loginError';
  if (
    error.startsWith('auth.') ||
    error.startsWith('onboarding.') ||
    error.startsWith('validation.') ||
    error.startsWith('planChangePage.')
  ) {
    return error;
  }

  const msg = error.toLowerCase();

  if (msg.includes('invalid login') || msg.includes('invalid credentials')) return 'auth.loginError';
  if (msg.includes('pending') && msg.includes('approval')) return 'auth.pendingApproval';
  if (msg.includes('already registered') || msg.includes('email already')) return 'auth.emailExists';
  if (msg.includes('company not found')) return 'auth.companyNotFound';
  if (msg.includes('join code')) return 'auth.joinCodeInvalid';
  if (msg.includes('company_user_limit') || msg.includes('user limit') || msg.includes('23514')) return 'onboarding.userLimitReached';
  if (msg.includes('company name') && (msg.includes('exists') || msg.includes('duplicate'))) return 'auth.companyNameExists';
  if (msg.includes('rate') || msg.includes('too many')) return 'auth.forgotPasswordRateLimit';
  if (msg.includes('password reset') && msg.includes('not available')) return 'auth.forgotPasswordNotConfigured';

  // Bilinmeyen hatalarda kod/metin gostermek yerine guvenli genel mesaj.
  return 'auth.loginError';
}

export const authService = {
  getVerifiedUser(): User | undefined { return verifiedUser ? { ...verifiedUser } : undefined; },
  subscribeSession(listener: () => void): () => void {
    sessionListeners.add(listener);
    return () => { sessionListeners.delete(listener); };
  },
  invalidateSession(): void { clearSession(); },

  async login(email: string, password: string, _companyId?: string): Promise<AuthResult> {
    clearSession();
    const version = sessionVersion;
    if (!supabase) return { ok: false, error: 'auth.notConfigured' };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizeEmailInput(email), password });
      if (error || !data.user) {
        await rejectSession(version);
        return { ok: false, error: error?.message ?? 'auth.loginError' };
      }
      const profile = await readProfile(data.user.id);
      if (version !== sessionVersion) return { ok: false, error: 'auth.loginError' };
      if (!isApprovedProfile(profile, data.user.id)) {
        await rejectSession(version);
        return { ok: false, error: 'auth.pendingApproval' };
      }
      if (profile.company_id) {
        const { fetchCompanyDataFromSupabase } = await import('@/lib/supabase/supabaseSyncService');
        if (version !== sessionVersion) return { ok: false, error: 'auth.loginError' };
        await fetchCompanyDataFromSupabase(profile.company_id);
      }
      if (version !== sessionVersion) return { ok: false, error: 'auth.loginError' };
      acceptProfile(profile, data.user.email ?? normalizeEmailInput(email));
      return { ok: true };
    } catch {
      await rejectSession(version);
      return { ok: false, error: 'auth.loginError' };
    }
  },

  /** Paid onboarding is disabled until server-side payment verification exists. */
  async registerNewCompany(params: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    joinCode: string;
    plan: 'starter' | 'professional' | 'enterprise';
    billingCycle?: 'monthly' | 'yearly';
  }): Promise<AuthResult> {
    void params;
    return { ok: false, error: 'onboarding.paidSignupDisabled' };
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

      const { data: capacityOk, error: capError } = await supabase.rpc('company_join_capacity_ok', {
        p_company_id: cId,
      });
      if (capError) {
        console.warn('[auth] company_join_capacity_ok:', capError.message);
      }
      if (capacityOk === false) {
        return { ok: false, error: 'onboarding.userLimitReached' };
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            join_company_name: name,
            join_code: code,
          },
        },
      });
      if (signUpError) {
        if (signUpError.message.includes('already registered')) return { ok: false, error: 'auth.emailExists' };
        const msg = (signUpError.message ?? '').toLowerCase();
        if (msg.includes('user limit') || msg.includes('company_user_limit') || msg.includes('23514')) {
          return { ok: false, error: 'onboarding.userLimitReached' };
        }
        return { ok: false, error: signUpError.message };
      }
      const userId = authData.user?.id;
      if (!userId) return { ok: false, error: 'auth.loginError' };
      // A signup session is not an approved application session.
      clearSession();
      if (authData.session) await supabase.auth.signOut({ scope: 'local' });
      return { ok: true };
    }
    clearSession();
    return { ok: false, error: 'auth.notConfigured' };
  },

  /** Oturum açık, şirketi olmayan kullanıcı: mevcut şirkete katılım talebi gönderir. */
  async requestJoinCompany(params: {
    companyName: string;
    joinCode: string;
  }): Promise<AuthResult> {
    const name = params.companyName.trim();
    const code = params.joinCode.trim();
    if (!/^\d{4}$/.test(code)) return { ok: false, error: 'auth.joinCodeInvalid' };
    if (!supabase) return { ok: false, error: 'auth.loginError' };

    const { data, error } = await supabase.rpc('request_join_company', {
      p_company_name: name,
      p_join_code: code,
    });
    if (error) return { ok: false, error: error.message };

    const row = data as { ok?: boolean; error?: string } | null;
    if (!row?.ok) {
      if (row?.error === 'company_not_found') return { ok: false, error: 'auth.companyNotFound' };
      if (row?.error === 'capacity_full') return { ok: false, error: 'onboarding.userLimitReached' };
      if (row?.error === 'already_member') return { ok: false, error: 'pendingJoin.alreadyMember' };
      return { ok: false, error: row?.error ?? 'auth.loginError' };
    }
    return { ok: true };
  },

  logout(): void {
    clearSession();
    void supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
  },

  async restoreSession(): Promise<boolean> {
    const version = ++sessionVersion;
    if (!supabase) { clearSession(); return false; }
    try {
      store.clearLegacyCredentials();
      // getUser verifies the JWT with Auth; getSession alone trusts browser storage.
      const { data, error } = await supabase.auth.getUser();
      if (version !== sessionVersion) return false;
      if (error || !data.user) { await rejectSession(version); return false; }
      const profile = await readProfile(data.user.id);
      if (version !== sessionVersion) return false;
      if (!isApprovedProfile(profile, data.user.id)) { await rejectSession(version); return false; }
      if (profile.company_id && (!verifiedUser || verifiedUser.companyId !== profile.company_id)) {
        const { fetchCompanyDataFromSupabase } = await import('@/lib/supabase/supabaseSyncService');
        if (version !== sessionVersion) return false;
        await fetchCompanyDataFromSupabase(profile.company_id);
      }
      if (version !== sessionVersion) return false;
      acceptProfile(profile, data.user.email ?? '');
      return true;
    } catch {
      await rejectSession(version);
      return false;
    }
  },

  /** Fetch profiles for company from Supabase (CM/PM only by RLS). Merge into store so pending users appear. */
  async fetchCompanyProfilesIntoStore(companyId: string): Promise<void> {
    if (!supabase || verifiedUser?.companyId !== companyId) return;
    const cacheVersion = store.getAuthCacheVersion();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, company_id, role, full_name, role_approval_status, email, can_see_prices')
      .eq('company_id', companyId);
    if (!profiles || cacheVersion !== store.getAuthCacheVersion()) return;
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

    const { upsertTeam } = await import('@/lib/supabase/supabaseSyncService');
    for (const t of store.getTeams(actingUser.companyId)) {
      if (t.wipedAt) continue;
      const patch: Partial<import('@/shared/types').Team> = {};
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
    const appUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
    const redirectOrigin = appUrl && /^https?:\/\//.test(appUrl) ? appUrl.replace(/\/$/, '') : window.location.origin;
    const normalizedEmail = normalizeEmailInput(email);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${redirectOrigin}/reset-password`,
    });
    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('rate') || msg.includes('too many') || error.status === 429) {
        return { ok: false, error: 'auth.forgotPasswordRateLimit' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },
};
