import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/providers/AppContext';
import { authService } from '@/features/auth/services/authService';
import {
  deleteCompanyAsSuperAdmin,
  setCompanyUsagePeriodAsSuperAdmin,
  setCompanyUserLimitAsSuperAdmin,
  type SuperAdminCompanyUser,
} from '@/features/settings/services/superAdminService';
import { getAdminUsagePeriodInfo } from '@/features/companies/services/subscriptionService';
import { getCompanyUserLimit } from '@/lib/permissions/planGating';
import { supabase } from '@/lib/supabase/supabaseClient';
import type { CompanyPlan } from '@/shared/types';
import styles from './SuperAdmin.module.css';

type CompanyRow = {
  id: string;
  name: string;
  plan: string | null;
  plan_status: string | null;
  subscription_status: string | null;
  join_code: string | null;
  billing_cycle: string | null;
  created_at?: string | null;
  max_users_override?: number | null;
  usage_period_days?: number | null;
  usage_period_started_at?: string | null;
  owner_user_id?: string | null;
};

type JoinRequest = {
  id: string;
  user_id: string;
  company_id: string;
  status: string;
  created_at: string;
  company_name?: string;
  user_name?: string;
  user_email?: string;
};

function formatDateTimeTr(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function companyPlan(plan: string | null | undefined): CompanyPlan | null {
  if (plan === 'starter' || plan === 'professional' || plan === 'enterprise') return plan;
  return null;
}

function roleLabel(role: string | null | undefined): string {
  if (!role) return '-';
  if (role === 'companyManager') return 'Şirket Yöneticisi';
  if (role === 'projectManager') return 'Proje Yöneticisi';
  if (role === 'teamLeader') return 'Ekip Lideri';
  return role;
}

function approvalLabel(status: string): string {
  if (status === 'approved') return 'Onaylı';
  if (status === 'pending') return 'Beklemede';
  if (status === 'rejected') return 'Reddedildi';
  return status;
}

function subscriptionBadge(status: string | null | undefined): { label: string; cls: string } {
  if (status === 'active') return { label: 'Aktif', cls: styles.badgeActive };
  if (status === 'suspended') return { label: 'Askıya Alındı', cls: styles.badgeSuspended };
  if (status === 'closed') return { label: 'Kapalı', cls: styles.badgeClosed };
  if (status === 'trial') return { label: 'Deneme', cls: styles.badgeTrial };
  return { label: 'Yeni', cls: styles.badgePending };
}

function planBadge(plan: string | null | undefined): string {
  if (plan === 'starter') return '🟢 Starter';
  if (plan === 'professional') return '🔵 Professional';
  if (plan === 'enterprise') return '🟣 Enterprise';
  return '-';
}

type Tab = 'companies' | 'pending' | 'joinRequests';

export function SuperAdmin() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companyUsers, setCompanyUsers] = useState<SuperAdminCompanyUser[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyRow | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [limitSavingId, setLimitSavingId] = useState<string | null>(null);
  const [usageDrafts, setUsageDrafts] = useState<Record<string, string>>({});
  const [usageSavingId, setUsageSavingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('companies');
  const [search, setSearch] = useState('');

  const loadData = useCallback(() => {
    if (!user || user.role !== 'superAdmin') return;
    if (!supabase) { setError('Supabase bağlantısı bulunamadı.'); setLoading(false); return; }
    setLoading(true);
    setError('');

    Promise.all([
      supabase.from('companies').select(
        'id, name, plan, plan_status, subscription_status, join_code, billing_cycle, created_at, max_users_override, usage_period_days, usage_period_started_at, owner_user_id',
        { count: 'exact' }
      ),
      supabase.from('profiles')
        .select('id, company_id, email, full_name, role, role_approval_status')
        .not('company_id', 'is', null)
        .neq('role', 'superAdmin')
        .order('full_name', { ascending: true }),
      supabase.from('join_requests')
        .select('id, user_id, company_id, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])
      .then(([companiesRes, membersRes, joinRes]) => {
        if (companiesRes.error) throw companiesRes.error;
        if (membersRes.error) throw membersRes.error;
        if (joinRes.error) throw joinRes.error;

        const comps = (companiesRes.data as CompanyRow[] | null) ?? [];
        const members = (membersRes.data as SuperAdminCompanyUser[]) ?? [];
        const joins = (joinRes.data as JoinRequest[] | null) ?? [];

        setCompanies(comps);
        setCompanyUsers(members);

        // Join requests'e şirket adı ve kullanıcı bilgisi ekle
        const compMap = new Map(comps.map(c => [c.id, c.name]));
        const userMap = new Map(members.map(m => [m.id, m]));
        setJoinRequests(joins.map(j => ({
          ...j,
          company_name: compMap.get(j.company_id) ?? j.company_id,
          user_name: userMap.get(j.user_id)?.full_name ?? '-',
          user_email: userMap.get(j.user_id)?.email ?? '-',
        })));
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Veriler alınamadı.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [companies]
  );

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return sortedCompanies;
    const q = search.toLowerCase();
    return sortedCompanies.filter(c => c.name.toLowerCase().includes(q));
  }, [sortedCompanies, search]);

  const pendingCompanies = useMemo(
    () => sortedCompanies.filter(c =>
      !c.subscription_status || c.subscription_status === 'trial' || c.subscription_status === 'pending'
    ),
    [sortedCompanies]
  );

  const usersByCompanyId = useMemo(() => {
    const map = new Map<string, SuperAdminCompanyUser[]>();
    for (const profile of companyUsers) {
      if (!profile.company_id) continue;
      const list = map.get(profile.company_id) ?? [];
      list.push(profile);
      map.set(profile.company_id, list);
    }
    return map;
  }, [companyUsers]);

  const stats = useMemo(() => ({
    companies: companies.length,
    users: companyUsers.length,
    pendingCompanies: pendingCompanies.length,
    pendingJoins: joinRequests.length,
    active: companies.filter(c => c.subscription_status === 'active').length,
    suspended: companies.filter(c => c.subscription_status === 'suspended').length,
  }), [companies, companyUsers, pendingCompanies, joinRequests]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleActivate = async (c: CompanyRow) => {
    if (!supabase) return;
    setActivatingId(c.id);
    setActionMessage('');
    const { data, error: err } = await supabase.rpc('super_admin_activate_company', { p_company_id: c.id });
    setActivatingId(null);
    if (err || !data) {
      setActionMessage(`${c.name}: etkinleştirilemedi.`);
      return;
    }
    setCompanies(prev => prev.map(r => r.id === c.id ? { ...r, subscription_status: 'active' } : r));
    setActionMessage(`✅ ${c.name} etkinleştirildi.`);
  };

  const handleSuspend = async (c: CompanyRow) => {
    if (!supabase) return;
    if (!confirm(`${c.name} şirketini askıya almak istediğinizden emin misiniz?`)) return;
    setActivatingId(c.id);
    setActionMessage('');
    const { data, error: err } = await supabase.rpc('super_admin_suspend_company', { p_company_id: c.id });
    setActivatingId(null);
    if (err || !data) {
      setActionMessage(`${c.name}: askıya alınamadı.`);
      return;
    }
    setCompanies(prev => prev.map(r => r.id === c.id ? { ...r, subscription_status: 'suspended' } : r));
    setActionMessage(`⚠️ ${c.name} askıya alındı.`);
  };

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmName.trim() !== deleteTarget.name.trim()) {
      setActionMessage('Şirket adı eşleşmiyor. Silme iptal edildi.');
      return;
    }
    setDeleteSubmitting(true);
    setActionMessage('');
    const result = await deleteCompanyAsSuperAdmin(deleteTarget.id);
    setDeleteSubmitting(false);
    if (!result.ok) {
      setActionMessage(result.error === 'forbidden' ? 'Yetkiniz yok.' : `Silme başarısız: ${result.error}`);
      return;
    }
    setActionMessage(`🗑️ ${deleteTarget.name} silindi. ${result.detachedUsers} kullanıcının üyeliği kaldırıldı.`);
    setDeleteTarget(null);
    setDeleteConfirmName('');
    loadData();
  };

  const applyLimitResult = (c: CompanyRow, result: { ok: true; maxUsers: number; maxUsersOverride: number | null }) => {
    setCompanies(prev => prev.map(r => r.id === c.id ? { ...r, max_users_override: result.maxUsersOverride } : r));
    setLimitDrafts(prev => ({ ...prev, [c.id]: result.maxUsersOverride != null ? String(result.maxUsersOverride) : '' }));
    setActionMessage(`${c.name}: geçerli limit ${result.maxUsers} kullanıcı.`);
  };

  const handleSaveUserLimit = async (c: CompanyRow) => {
    const raw = (limitDrafts[c.id] ?? '').trim();
    const parsed = raw === '' ? null : Number.parseInt(raw, 10);
    if (raw !== '' && (Number.isNaN(parsed) || parsed! < 1 || parsed! > 999)) {
      setActionMessage('Limit 1 ile 999 arasında olmalıdır.');
      return;
    }
    setLimitSavingId(c.id);
    const result = await setCompanyUserLimitAsSuperAdmin(c.id, parsed);
    setLimitSavingId(null);
    if (!result.ok) {
      setActionMessage(result.error === 'forbidden' ? 'Yetkiniz yok.' : `Limit kaydedilemedi: ${result.error}`);
      return;
    }
    applyLimitResult(c, result);
  };

  const handleResetUserLimitToPlan = async (c: CompanyRow) => {
    setLimitSavingId(c.id);
    const result = await setCompanyUserLimitAsSuperAdmin(c.id, null);
    setLimitSavingId(null);
    if (!result.ok) {
      setActionMessage(result.error === 'forbidden' ? 'Yetkiniz yok.' : `Limit sıfırlanamadı: ${result.error}`);
      return;
    }
    applyLimitResult(c, result);
  };

  const handleSaveUsagePeriod = async (c: CompanyRow) => {
    const raw = (usageDrafts[c.id] ?? '').trim();
    const parsed = raw === '' ? null : Number.parseInt(raw, 10);
    if (raw !== '' && (Number.isNaN(parsed) || parsed! < 1 || parsed! > 3650)) {
      setActionMessage('Kullanım süresi 1 ile 3650 gün arasında olmalıdır.');
      return;
    }
    setUsageSavingId(c.id);
    const result = await setCompanyUsagePeriodAsSuperAdmin(c.id, parsed);
    setUsageSavingId(null);
    if (!result.ok) {
      setActionMessage(result.error === 'forbidden' ? 'Yetkiniz yok.' : `Kullanım süresi kaydedilemedi: ${result.error}`);
      return;
    }
    setCompanies(prev => prev.map(r =>
      r.id === c.id ? { ...r, usage_period_days: result.usagePeriodDays, usage_period_started_at: result.usagePeriodStartedAt } : r
    ));
    setActionMessage(result.usagePeriodDays == null
      ? `${c.name}: kullanım süresi kaldırıldı.`
      : `${c.name}: ${result.usagePeriodDays} gün — bitiş ${formatDateTimeTr(result.usageExpiresAt)}`
    );
  };

  const toggleCompanyExpand = (c: CompanyRow) => {
    const next = expandedCompanyId === c.id ? null : c.id;
    setExpandedCompanyId(next);
    if (next) {
      setLimitDrafts(prev => ({ ...prev, [c.id]: c.max_users_override != null ? String(c.max_users_override) : '' }));
      setUsageDrafts(prev => ({ ...prev, [c.id]: c.usage_period_days != null ? String(c.usage_period_days) : '' }));
      setActionMessage('');
    }
  };

  if (!user || user.role !== 'superAdmin') return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Süper Admin Paneli</h1>
          <p className={styles.subtitle}>Tüm şirket ve kullanıcı yönetimi</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.refreshBtn} onClick={loadData}>↺ Yenile</button>
          <button type="button" className={styles.logoutBtn} onClick={() => {
            authService.logout();
            setUser(undefined);
            navigate('/login', { replace: true });
          }}>Çıkış</button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>🏢</span>
          <div>
            <div className={styles.statValue}>{stats.companies}</div>
            <div className={styles.statLabel}>Toplam Şirket</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>👥</span>
          <div>
            <div className={styles.statValue}>{stats.users}</div>
            <div className={styles.statLabel}>Toplam Kullanıcı</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${stats.pendingCompanies > 0 ? styles.statCardWarn : ''}`}>
          <span className={styles.statIcon}>⏳</span>
          <div>
            <div className={styles.statValue}>{stats.pendingCompanies}</div>
            <div className={styles.statLabel}>Onay Bekleyen Şirket</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${stats.pendingJoins > 0 ? styles.statCardWarn : ''}`}>
          <span className={styles.statIcon}>🔔</span>
          <div>
            <div className={styles.statValue}>{stats.pendingJoins}</div>
            <div className={styles.statLabel}>Bekleyen Katılım Talebi</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>✅</span>
          <div>
            <div className={styles.statValue}>{stats.active}</div>
            <div className={styles.statLabel}>Aktif Şirket</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>⚠️</span>
          <div>
            <div className={styles.statValue}>{stats.suspended}</div>
            <div className={styles.statLabel}>Askıya Alınan</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {loading && <p className={styles.muted}>Yükleniyor...</p>}
      {error && <p className={styles.error}>{error}</p>}
      {actionMessage && (
        <div className={styles.actionMsg} onClick={() => setActionMessage('')}>
          {actionMessage} <span className={styles.dismissX}>✕</span>
        </div>
      )}

      {/* Tabs */}
      {!loading && !error && (
        <>
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tab} ${tab === 'companies' ? styles.tabActive : ''}`} onClick={() => setTab('companies')}>
              Şirketler <span className={styles.tabBadge}>{stats.companies}</span>
            </button>
            <button type="button" className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`} onClick={() => setTab('pending')}>
              Onay Bekleyenler
              {stats.pendingCompanies > 0 && <span className={`${styles.tabBadge} ${styles.tabBadgeWarn}`}>{stats.pendingCompanies}</span>}
            </button>
            <button type="button" className={`${styles.tab} ${tab === 'joinRequests' ? styles.tabActive : ''}`} onClick={() => setTab('joinRequests')}>
              Katılım Talepleri
              {stats.pendingJoins > 0 && <span className={`${styles.tabBadge} ${styles.tabBadgeWarn}`}>{stats.pendingJoins}</span>}
            </button>
          </div>

          {/* ── Tab: Companies ─────────────────────────────────────────── */}
          {tab === 'companies' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Tüm Şirketler</h2>
                <input
                  type="text"
                  placeholder="Şirket ara..."
                  className={styles.searchInput}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Şirket</th>
                      <th>Plan</th>
                      <th>Durum</th>
                      <th>Üyeler</th>
                      <th>Kayıt Tarihi</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map(c => {
                      const members = usersByCompanyId.get(c.id) ?? [];
                      const approvedCount = members.filter(m => m.role_approval_status === 'approved').length;
                      const plan = companyPlan(c.plan);
                      const effectiveLimit = getCompanyUserLimit(plan, c.max_users_override);
                      const usageInfo = getAdminUsagePeriodInfo(c);
                      const isExpanded = expandedCompanyId === c.id;
                      const badge = subscriptionBadge(c.subscription_status);

                      return (
                        <Fragment key={c.id}>
                          <tr className={isExpanded ? styles.expandedRow : undefined}>
                            <td>
                              <div className={styles.companyName}>{c.name}</div>
                              {c.join_code && <span className={styles.joinCodeHint}>Kod: {c.join_code}</span>}
                            </td>
                            <td>
                              <span className={styles.planText}>{planBadge(c.plan)}</span>
                              <div className={styles.limitHint}>{approvedCount}/{effectiveLimit === Infinity ? '∞' : effectiveLimit} üye</div>
                            </td>
                            <td>
                              <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
                              {usageInfo.isConfigured && (
                                <div className={usageInfo.isExpired ? styles.usageExpiredHint : styles.usageActiveHint}>
                                  {usageInfo.isExpired ? 'Süresi doldu' : `${usageInfo.remainingDays ?? 0} gün kaldı`}
                                </div>
                              )}
                            </td>
                            <td>
                              <button type="button" className={styles.toggleBtn} onClick={() => toggleCompanyExpand(c)} aria-expanded={isExpanded}>
                                {members.length} kişi {isExpanded ? '▲' : '▼'}
                              </button>
                            </td>
                            <td className={styles.muted}>{formatDateTimeTr(c.created_at)}</td>
                            <td>
                              <div className={styles.actionBtns}>
                                {c.subscription_status !== 'active' && (
                                  <button type="button" className={styles.activateBtn}
                                    disabled={activatingId === c.id}
                                    onClick={() => void handleActivate(c)}>
                                    {activatingId === c.id ? '...' : '✅ Etkinleştir'}
                                  </button>
                                )}
                                {c.subscription_status === 'active' && (
                                  <button type="button" className={styles.suspendBtn}
                                    disabled={activatingId === c.id}
                                    onClick={() => void handleSuspend(c)}>
                                    {activatingId === c.id ? '...' : '⚠️ Askıya Al'}
                                  </button>
                                )}
                                <button type="button" className={styles.deleteBtn}
                                  onClick={() => { setDeleteTarget(c); setDeleteConfirmName(''); setActionMessage(''); }}>
                                  🗑️ Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className={styles.usersRow}>
                              <td colSpan={6}>
                                {/* Limit panel */}
                                <div className={styles.panelGrid}>
                                  <div className={styles.limitPanel}>
                                    <p className={styles.limitPanelTitle}>Üye Limiti</p>
                                    <p className={styles.muted}>
                                      Geçerli: {effectiveLimit === Infinity ? '∞' : effectiveLimit}
                                      {c.max_users_override != null ? ` (özel: ${c.max_users_override})` : ''} · Onaylı: {approvedCount}
                                    </p>
                                    <div className={styles.limitForm}>
                                      <label className={styles.limitLabel}>
                                        Maks. üye
                                        <input type="number" min={1} max={999} className={styles.limitInput}
                                          value={limitDrafts[c.id] ?? ''} placeholder="örn. 10"
                                          onChange={e => setLimitDrafts(prev => ({ ...prev, [c.id]: e.target.value }))} />
                                      </label>
                                      <button type="button" className={styles.saveLimitBtn} disabled={limitSavingId === c.id}
                                        onClick={() => void handleSaveUserLimit(c)}>
                                        {limitSavingId === c.id ? '...' : 'Kaydet'}
                                      </button>
                                      <button type="button" className={styles.cancelBtn} disabled={limitSavingId === c.id}
                                        onClick={() => void handleResetUserLimitToPlan(c)}>
                                        Sıfırla
                                      </button>
                                    </div>
                                  </div>
                                  <div className={styles.limitPanel}>
                                    <p className={styles.limitPanelTitle}>Kullanım Süresi</p>
                                    <p className={styles.muted}>
                                      {usageInfo.isConfigured
                                        ? usageInfo.isExpired
                                          ? `Süresi doldu (${formatDateTimeTr(usageInfo.expiresAt)})`
                                          : `Bitiş: ${formatDateTimeTr(usageInfo.expiresAt)} · ${usageInfo.remainingDays ?? 0} gün`
                                        : 'Tanımlı süre yok.'}
                                    </p>
                                    <div className={styles.limitForm}>
                                      <label className={styles.limitLabel}>
                                        Gün (boş = kaldır)
                                        <input type="number" min={1} max={3650} className={styles.limitInput}
                                          value={usageDrafts[c.id] ?? ''} placeholder="örn. 30"
                                          onChange={e => setUsageDrafts(prev => ({ ...prev, [c.id]: e.target.value }))} />
                                      </label>
                                      <button type="button" className={styles.saveLimitBtn}
                                        disabled={usageSavingId === c.id || limitSavingId === c.id}
                                        onClick={() => void handleSaveUsagePeriod(c)}>
                                        {usageSavingId === c.id ? '...' : 'Kaydet'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                {/* Members table */}
                                {members.length === 0
                                  ? <p className={styles.muted}>Bu şirkette kayıtlı kullanıcı yok.</p>
                                  : (
                                    <table className={styles.usersTable}>
                                      <thead>
                                        <tr><th>Ad Soyad</th><th>E-posta</th><th>Rol</th><th>Durum</th></tr>
                                      </thead>
                                      <tbody>
                                        {members.map(m => (
                                          <tr key={m.id}>
                                            <td>{m.full_name?.trim() || '-'}</td>
                                            <td>{m.email?.trim() || '-'}</td>
                                            <td>{roleLabel(m.role)}</td>
                                            <td>
                                              <span className={m.role_approval_status === 'approved' ? styles.approvedText : styles.pendingText}>
                                                {approvalLabel(m.role_approval_status)}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {filteredCompanies.length === 0 && (
                      <tr><td colSpan={6} className={styles.muted}>Sonuç bulunamadı.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Tab: Pending ───────────────────────────────────────────── */}
          {tab === 'pending' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Onay Bekleyen Şirketler</h2>
                <p className={styles.sectionDesc}>Mobil uygulama üzerinden oluşturulan ve henüz aktifleştirilmemiş şirketler.</p>
              </div>
              {pendingCompanies.length === 0
                ? <p className={styles.emptyState}>✅ Onay bekleyen şirket yok.</p>
                : (
                  <div className={styles.pendingList}>
                    {pendingCompanies.map(c => {
                      const members = usersByCompanyId.get(c.id) ?? [];
                      const badge = subscriptionBadge(c.subscription_status);
                      return (
                        <div key={c.id} className={styles.pendingCard}>
                          <div className={styles.pendingCardHeader}>
                            <div>
                              <div className={styles.pendingCompanyName}>{c.name}</div>
                              <div className={styles.pendingMeta}>
                                <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
                                <span className={styles.muted}>{planBadge(c.plan)}</span>
                                <span className={styles.muted}>{members.length} kullanıcı</span>
                                <span className={styles.muted}>Katılım Kodu: <strong>{c.join_code ?? '-'}</strong></span>
                                <span className={styles.muted}>Kayıt: {formatDateTimeTr(c.created_at)}</span>
                              </div>
                            </div>
                            <div className={styles.pendingActions}>
                              <button type="button" className={styles.activateBtnLg}
                                disabled={activatingId === c.id}
                                onClick={() => void handleActivate(c)}>
                                {activatingId === c.id ? 'İşleniyor...' : '✅ Etkinleştir'}
                              </button>
                              <button type="button" className={styles.deleteBtn}
                                onClick={() => { setDeleteTarget(c); setDeleteConfirmName(''); setActionMessage(''); }}>
                                🗑️ Sil
                              </button>
                            </div>
                          </div>
                          {members.length > 0 && (
                            <table className={styles.usersTable}>
                              <thead><tr><th>Ad Soyad</th><th>E-posta</th><th>Rol</th><th>Durum</th></tr></thead>
                              <tbody>
                                {members.map(m => (
                                  <tr key={m.id}>
                                    <td>{m.full_name?.trim() || '-'}</td>
                                    <td>{m.email?.trim() || '-'}</td>
                                    <td>{roleLabel(m.role)}</td>
                                    <td>
                                      <span className={m.role_approval_status === 'approved' ? styles.approvedText : styles.pendingText}>
                                        {approvalLabel(m.role_approval_status)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
            </section>
          )}

          {/* ── Tab: Join Requests ─────────────────────────────────────── */}
          {tab === 'joinRequests' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Bekleyen Katılım Talepleri</h2>
                <p className={styles.sectionDesc}>Şirketlere katılım onayı bekleyen kullanıcılar. Onay için ilgili şirket yöneticisi giriş yapmalıdır.</p>
              </div>
              {joinRequests.length === 0
                ? <p className={styles.emptyState}>✅ Bekleyen katılım talebi yok.</p>
                : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Kullanıcı</th>
                          <th>E-posta</th>
                          <th>Şirket</th>
                          <th>Talep Tarihi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {joinRequests.map(jr => (
                          <tr key={jr.id}>
                            <td>{jr.user_name}</td>
                            <td>{jr.user_email}</td>
                            <td><span className={styles.companyName}>{jr.company_name}</span></td>
                            <td className={styles.muted}>{formatDateTimeTr(jr.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>
          )}
        </>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Şirketi Sil: {deleteTarget.name}</h2>
            <p className={styles.modalText}>
              Bu işlem geri alınamaz. Tüm şirket verileri kalıcı olarak silinir. Kullanıcı hesapları korunur; yalnızca üyelikleri kaldırılır. Onaylamak için şirket adını yazın.
            </p>
            <label className={styles.modalLabel}>
              Şirket adı
              <input type="text" className={styles.modalInput}
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget.name} autoComplete="off" />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.deleteBtn}
                disabled={deleteSubmitting || deleteConfirmName.trim() !== deleteTarget.name.trim()}
                onClick={() => void handleDeleteCompany()}>
                {deleteSubmitting ? 'Siliniyor...' : 'Kalıcı Sil'}
              </button>
              <button type="button" className={styles.cancelBtn} disabled={deleteSubmitting}
                onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
