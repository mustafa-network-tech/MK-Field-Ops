import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import styles from './SuperAdmin.module.css';

type CompanyRow = {
  id: string;
  name: string;
  plan: string | null;
  created_at?: string | null;
};

function planLabel(plan: string | null | undefined): string {
  if (!plan) return '-';
  if (plan === 'starter') return 'Baslangic';
  if (plan === 'professional') return 'Profesyonel';
  if (plan === 'enterprise') return 'Kurumsal';
  return plan;
}

export function SuperAdmin() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyCount, setCompanyCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'superAdmin') return;
    if (!supabase) {
      setError('Supabase baglantisi bulunamadi.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    Promise.all([
      supabase.from('companies').select('id, name, plan, created_at', { count: 'exact' }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ])
      .then(([companiesRes, usersRes]) => {
        if (companiesRes.error) throw companiesRes.error;
        if (usersRes.error) throw usersRes.error;
        setCompanies((companiesRes.data as CompanyRow[] | null) ?? []);
        setCompanyCount(companiesRes.count ?? 0);
        setUserCount(usersRes.count ?? 0);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Super admin verileri alinamadi.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [companies]
  );

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

      {!loading && !error && (
        <>
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
            <h2 className={styles.sectionTitle}>Sirketler ve Planlari</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Sirket</th>
                    <th>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCompanies.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{planLabel(c.plan)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

