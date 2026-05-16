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
  created_at?: string | null;
  max_users_override?: number | null;
  usage_period_days?: number | null;
  usage_period_started_at?: string | null;
};

function formatDateTimeTr(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function companyPlan(plan: string | null | undefined): CompanyPlan | null {
  if (plan === 'starter' || plan === 'professional' || plan === 'enterprise') return plan;
  return null;
}

function roleLabel(role: string | null | undefined): string {
  if (!role) return '-';
  if (role === 'companyManager') return 'Sirket Yoneticisi';
  if (role === 'projectManager') return 'Proje Yoneticisi';
  if (role === 'teamLeader') return 'Ekip Lideri';
  return role;
}

function approvalLabel(status: string): string {
  if (status === 'approved') return 'Onayli';
  if (status === 'pending') return 'Beklemede';
  if (status === 'rejected') return 'Reddedildi';
  return status;
}

export function SuperAdmin() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyCount, setCompanyCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companyUsers, setCompanyUsers] = useState<SuperAdminCompanyUser[]>([]);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyRow | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [limitSavingId, setLimitSavingId] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState('');
  const [usageDrafts, setUsageDrafts] = useState<Record<string, string>>({});
  const [usageSavingId, setUsageSavingId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!user || user.role !== 'superAdmin') return;
    if (!supabase) {
      setError('Supabase baglantisi bulunamadi.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    Promise.all([
      supabase
        .from('companies')
        .select(
          'id, name, plan, created_at, max_users_override, usage_period_days, usage_period_started_at',
          { count: 'exact' }
        ),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('id, company_id, email, full_name, role, role_approval_status')
        .not('company_id', 'is', null)
        .neq('role', 'superAdmin')
        .order('full_name', { ascending: true }),
    ])
      .then(([companiesRes, usersRes, membersRes]) => {
        if (companiesRes.error) throw companiesRes.error;
        if (usersRes.error) throw usersRes.error;
        if (membersRes.error) throw membersRes.error;
        setCompanies((companiesRes.data as CompanyRow[] | null) ?? []);
        setCompanyCount(companiesRes.count ?? 0);
        setUserCount(usersRes.count ?? 0);
        setCompanyUsers((membersRes.data as SuperAdminCompanyUser[]) ?? []);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Super admin verileri alinamadi.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [companies]
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

  const handleDeleteCompany = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmName.trim() !== deleteTarget.name.trim()) {
      setDeleteMessage('Sirket adi eslesmiyor. Silme iptal edildi.');
      return;
    }
    setDeleteSubmitting(true);
    setDeleteMessage('');
    const result = await deleteCompanyAsSuperAdmin(deleteTarget.id);
    setDeleteSubmitting(false);
    if (!result.ok) {
      setDeleteMessage(result.error === 'forbidden' ? 'Yetkiniz yok.' : `Silme basarisiz: ${result.error}`);
      return;
    }
    setDeleteMessage(
      `${deleteTarget.name} silindi. ${result.detachedUsers} kullanicinin uyeligi kaldirildi; hesaplari engellenmedi.`
    );
    setDeleteTarget(null);
    setDeleteConfirmName('');
    loadData();
  };

  const applyLimitResult = (c: CompanyRow, result: { ok: true; maxUsers: number; maxUsersOverride: number | null }) => {
    setCompanies((prev) =>
      prev.map((row) =>
        row.id === c.id ? { ...row, max_users_override: result.maxUsersOverride } : row
      )
    );
    setLimitDrafts((prev) => ({
      ...prev,
      [c.id]: result.maxUsersOverride != null ? String(result.maxUsersOverride) : '',
    }));
    setLimitMessage(`${c.name}: gecerli limit ${result.maxUsers} kullanici.`);
  };

  const handleSaveUserLimit = async (c: CompanyRow) => {
    const raw = (limitDrafts[c.id] ?? '').trim();
    const parsed = raw === '' ? null : Number.parseInt(raw, 10);
    if (raw !== '' && (Number.isNaN(parsed) || parsed! < 1 || parsed! > 999)) {
      setLimitMessage('Limit 1 ile 999 arasinda olmalidir.');
      return;
    }
    setLimitSavingId(c.id);
    setLimitMessage('');
    const result = await setCompanyUserLimitAsSuperAdmin(c.id, parsed);
    setLimitSavingId(null);
    if (!result.ok) {
      setLimitMessage(result.error === 'forbidden' ? 'Yetkiniz yok.' : `Limit kaydedilemedi: ${result.error}`);
      return;
    }
    applyLimitResult(c, result);
  };

  const handleResetUserLimitToPlan = async (c: CompanyRow) => {
    setLimitSavingId(c.id);
    setLimitMessage('');
    const result = await setCompanyUserLimitAsSuperAdmin(c.id, null);
    setLimitSavingId(null);
    if (!result.ok) {
      setLimitMessage(result.error === 'forbidden' ? 'Yetkiniz yok.' : `Limit sifirlanamadi: ${result.error}`);
      return;
    }
    applyLimitResult(c, result);
  };

  const handleSaveUsagePeriod = async (c: CompanyRow) => {
    const raw = (usageDrafts[c.id] ?? '').trim();
    const parsed = raw === '' ? null : Number.parseInt(raw, 10);
    if (raw !== '' && (Number.isNaN(parsed) || parsed! < 1 || parsed! > 3650)) {
      setLimitMessage('Kullanim suresi 1 ile 3650 gun arasinda olmalidir.');
      return;
    }
    setUsageSavingId(c.id);
    setLimitMessage('');
    const result = await setCompanyUsagePeriodAsSuperAdmin(c.id, parsed);
    setUsageSavingId(null);
    if (!result.ok) {
      setLimitMessage(
        result.error === 'forbidden' ? 'Yetkiniz yok.' : `Kullanim suresi kaydedilemedi: ${result.error}`
      );
      return;
    }
    setCompanies((prev) =>
      prev.map((row) =>
        row.id === c.id
          ? {
              ...row,
              usage_period_days: result.usagePeriodDays,
              usage_period_started_at: result.usagePeriodStartedAt,
            }
          : row
      )
    );
    setUsageDrafts((prev) => ({
      ...prev,
      [c.id]: result.usagePeriodDays != null ? String(result.usagePeriodDays) : '',
    }));
    setLimitMessage(
      result.usagePeriodDays == null
        ? `${c.name}: kullanim suresi kaldirildi.`
        : `${c.name}: ${result.usagePeriodDays} gun — bitis ${formatDateTimeTr(result.usageExpiresAt)}`
    );
  };

  const toggleCompanyExpand = (c: CompanyRow) => {
    const next = expandedCompanyId === c.id ? null : c.id;
    setExpandedCompanyId(next);
    if (next) {
      setLimitDrafts((prev) => ({
        ...prev,
        [c.id]: c.max_users_override != null ? String(c.max_users_override) : '',
      }));
      setUsageDrafts((prev) => ({
        ...prev,
        [c.id]: c.usage_period_days != null ? String(c.usage_period_days) : '',
      }));
      setLimitMessage('');
    }
  };

  if (!user || user.role !== 'superAdmin') return null;

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1 className={styles.title}>Super Admin Paneli</h1>
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={() => {
            authService.logout();
            setUser(undefined);
            navigate('/login', { replace: true });
          }}
        >
          Cikis
        </button>
      </div>

      {loading ? <p className={styles.muted}>Yukleniyor...</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {deleteMessage ? <p className={styles.notice}>{deleteMessage}</p> : null}
      {limitMessage ? <p className={styles.notice}>{limitMessage}</p> : null}

      {!loading && !error && (
        <>
          <p className={styles.notice}>
            <strong>Not:</strong> Sirket silindiginde tum operasyonel veriler kalici olarak silinir. Uyelerin
            Authentication hesabi kalir; yalnizca sirket uyeligi kaldirilir ve baska bir sirkete katilabilirler.
          </p>
          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Toplam Sirket</span>
              <strong className={styles.cardValue}>{companyCount}</strong>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Toplam Kullanici</span>
              <strong className={styles.cardValue}>{userCount}</strong>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sirketler</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Sirket</th>
                    <th>Uyeler</th>
                    <th>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCompanies.map((c) => {
                    const members = usersByCompanyId.get(c.id) ?? [];
                    const approvedCount = members.filter((m) => m.role_approval_status === 'approved').length;
                    const plan = companyPlan(c.plan);
                    const effectiveLimit = getCompanyUserLimit(plan, c.max_users_override);
                    const usageInfo = getAdminUsagePeriodInfo(c);
                    const isExpanded = expandedCompanyId === c.id;
                    return (
                      <Fragment key={c.id}>
                        <tr>
                          <td>
                            <span className={styles.companyName}>{c.name}</span>
                            <span className={styles.limitHint}>
                              {' '}
                              ({approvedCount}/{effectiveLimit === Infinity ? '∞' : effectiveLimit} uye)
                            </span>
                            {usageInfo.isConfigured ? (
                              <span
                                className={
                                  usageInfo.isExpired ? styles.usageExpiredHint : styles.usageActiveHint
                                }
                              >
                                {' '}
                                · Kullanim:{' '}
                                {usageInfo.isExpired
                                  ? 'suresi doldu'
                                  : `${usageInfo.remainingDays ?? 0} gun kaldi`}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.toggleBtn}
                              onClick={() => toggleCompanyExpand(c)}
                              aria-expanded={isExpanded}
                            >
                              {members.length} kullanici — {isExpanded ? 'Gizle' : 'Goster'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={() => {
                                setDeleteTarget(c);
                                setDeleteConfirmName('');
                                setDeleteMessage('');
                              }}
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr key={`${c.id}-users`} className={styles.usersRow}>
                            <td colSpan={3}>
                              <div className={styles.limitPanel}>
                                <p className={styles.limitPanelTitle}>Uye limiti</p>
                                <p className={styles.muted}>
                                  Gecerli kota: {effectiveLimit === Infinity ? '∞' : effectiveLimit}
                                  {c.max_users_override != null
                                    ? ` (ozel: ${c.max_users_override})`
                                    : ''}
                                  {' · '}
                                  Kullanilan (onayli): {approvedCount}
                                </p>
                                <div className={styles.limitForm}>
                                  <label className={styles.limitLabel}>
                                    Maksimum uye sayisi
                                    <input
                                      type="number"
                                      min={1}
                                      max={999}
                                      className={styles.limitInput}
                                      value={limitDrafts[c.id] ?? ''}
                                      placeholder="orn. 10"
                                      onChange={(e) =>
                                        setLimitDrafts((prev) => ({
                                          ...prev,
                                          [c.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className={styles.saveLimitBtn}
                                    disabled={limitSavingId === c.id}
                                    onClick={() => void handleSaveUserLimit(c)}
                                  >
                                    {limitSavingId === c.id ? 'Kaydediliyor...' : 'Limiti kaydet'}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    disabled={limitSavingId === c.id}
                                    onClick={() => void handleResetUserLimitToPlan(c)}
                                  >
                                    Ozel limiti kaldir
                                  </button>
                                </div>
                              </div>
                              <div className={styles.limitPanel}>
                                <p className={styles.limitPanelTitle}>Kullanim suresi (gun)</p>
                                <p className={styles.muted}>
                                  {usageInfo.isConfigured
                                    ? usageInfo.isExpired
                                      ? `Sure doldu (${formatDateTimeTr(usageInfo.expiresAt)}). Sirket verileri gorur, yeni islem yapamaz.`
                                      : `Bitis: ${formatDateTimeTr(usageInfo.expiresAt)} · Kalan: ${usageInfo.remainingDays ?? 0} gun`
                                    : 'Tanimli sure yok. Kaydettiginizde sure bugunden baslar.'}
                                </p>
                                <div className={styles.limitForm}>
                                  <label className={styles.limitLabel}>
                                    Gun sayisi (bos = kaldir)
                                    <input
                                      type="number"
                                      min={1}
                                      max={3650}
                                      className={styles.limitInput}
                                      value={usageDrafts[c.id] ?? ''}
                                      placeholder="orn. 30"
                                      onChange={(e) =>
                                        setUsageDrafts((prev) => ({
                                          ...prev,
                                          [c.id]: e.target.value,
                                        }))
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className={styles.saveLimitBtn}
                                    disabled={usageSavingId === c.id || limitSavingId === c.id}
                                    onClick={() => void handleSaveUsagePeriod(c)}
                                  >
                                    {usageSavingId === c.id ? 'Kaydediliyor...' : 'Sureyi kaydet'}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    disabled={usageSavingId === c.id}
                                    onClick={() => {
                                      setUsageDrafts((prev) => ({ ...prev, [c.id]: '' }));
                                      void setCompanyUsagePeriodAsSuperAdmin(c.id, null).then((result) => {
                                        if (result.ok) {
                                          setCompanies((prev) =>
                                            prev.map((row) =>
                                              row.id === c.id
                                                ? {
                                                    ...row,
                                                    usage_period_days: null,
                                                    usage_period_started_at: null,
                                                  }
                                                : row
                                            )
                                          );
                                          setLimitMessage(`${c.name}: kullanim suresi kaldirildi.`);
                                        }
                                      });
                                    }}
                                  >
                                    Sureyi kaldir
                                  </button>
                                </div>
                              </div>
                              {members.length === 0 ? (
                                <p className={styles.muted}>Bu sirkette kayitli kullanici yok.</p>
                              ) : (
                                <table className={styles.usersTable}>
                                  <thead>
                                    <tr>
                                      <th>Ad Soyad</th>
                                      <th>E-posta</th>
                                      <th>Rol</th>
                                      <th>Durum</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {members.map((m) => (
                                      <tr key={m.id}>
                                        <td>{m.full_name?.trim() || '-'}</td>
                                        <td>{m.email?.trim() || '-'}</td>
                                        <td>{roleLabel(m.role)}</td>
                                        <td>{approvalLabel(m.role_approval_status)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {deleteTarget ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-labelledby="delete-company-title">
            <h2 id="delete-company-title" className={styles.modalTitle}>
              Sirketi sil: {deleteTarget.name}
            </h2>
            <p className={styles.modalText}>
              Bu islem geri alinamaz. Sirket verileri silinir; kullanici hesaplari engellenmez, yalnizca uyelikleri
              kaldirilir. Onaylamak icin sirket adini yazin.
            </p>
            <label className={styles.modalLabel}>
              Sirket adi
              <input
                type="text"
                className={styles.modalInput}
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget.name}
                autoComplete="off"
              />
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.deleteBtn}
                disabled={deleteSubmitting || deleteConfirmName.trim() !== deleteTarget.name.trim()}
                onClick={() => void handleDeleteCompany()}
              >
                {deleteSubmitting ? 'Siliniyor...' : 'Kalici sil'}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={deleteSubmitting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmName('');
                }}
              >
                Iptal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
