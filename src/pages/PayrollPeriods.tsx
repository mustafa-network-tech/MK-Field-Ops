import { useState, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getPayrollPeriods, getPayrollPeriodSummary } from '../services/payrollPeriodService';
import { formatCurrency } from '../utils/formatLocale';
import { Card } from '../components/ui/Card';
import styles from './PayrollPeriods.module.css';

export function PayrollPeriods() {
  const { t, locale } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const canAccess = user?.role === 'companyManager' || user?.role === 'projectManager';

  const periods = useMemo(() => getPayrollPeriods(companyId), [companyId]);
  const hasSettings = useMemo(() => !!store.getPayrollPeriodSettings(companyId), [companyId]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedPeriod = periods[selectedIndex] ?? null;

  const summary = useMemo(() => {
    if (!companyId || !selectedPeriod) return null;
    return getPayrollPeriodSummary(companyId, selectedPeriod);
  }, [companyId, selectedPeriod]);

  const formatMoney = (n: number) => formatCurrency(n, locale);

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('payroll.title')}</h1>
        <p className={styles.muted}>{t('payroll.accessRestricted')}</p>
      </div>
    );
  }

  if (!hasSettings) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('payroll.title')}</h1>
        <p className={styles.muted}>{t('payroll.noSettings')}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('payroll.title')}</h1>
      <p className={styles.subtitle}>{t('payroll.subtitle')}</p>

      <div className={styles.periodSelect}>
        <label htmlFor="period">{t('payroll.selectPeriod')}</label>
        <div className={styles.periodSelectRow}>
          <select
            id="period"
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className={styles.select}
          >
            {periods.map((p, i) => (
              <option key={`${p.start}-${p.end}`} value={i}>
                {p.label ?? `${p.start} – ${p.end}`}
                {p.isActive ? ` (${t('payroll.active')})` : ''}
              </option>
            ))}
          </select>
          {selectedPeriod?.isActive && (
            <span className={styles.badge} aria-label={t('payroll.active')}>
              {t('payroll.active')}
            </span>
          )}
        </div>
      </div>

      {summary && (
        <>
          <Card title={t('payroll.companyTotals')}>
            <div className={styles.totalsGrid}>
              <div className={styles.totalsItem}>
                <span className={styles.totalsLabel}>{t('payroll.totalJobValue')}</span>
                <span className={styles.totalsValue}>{formatMoney(summary.company.totalWorkValue)}</span>
              </div>
              <div className={styles.totalsItem}>
                <span className={styles.totalsLabel}>{t('payroll.companyShare')}</span>
                <span className={styles.totalsValue}>{formatMoney(summary.company.companyShare)}</span>
              </div>
              <div className={styles.totalsItem}>
                <span className={styles.totalsLabel}>{t('payroll.teamShare')}</span>
                <span className={styles.totalsValue}>{formatMoney(summary.company.teamShare)}</span>
              </div>
              <div className={styles.totalsItem}>
                <span className={styles.totalsLabel}>{t('payroll.approvedJobsCount')}</span>
                <span className={styles.totalsValue}>{summary.company.approvedJobsCount}</span>
              </div>
            </div>
          </Card>

          <Card title={t('payroll.teamsTable')}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('payroll.teamCode')}</th>
                    <th>{t('payroll.totalJobValue')}</th>
                    <th>{t('payroll.companyShare')}</th>
                    <th>{t('payroll.teamShare')}</th>
                    <th>{t('payroll.approvedJobsCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.teams.map((row) => (
                    <tr key={row.teamId}>
                      <td><strong>{row.teamCode}</strong></td>
                      <td>{formatMoney(row.totalWorkValue)}</td>
                      <td>{formatMoney(row.companyShare)}</td>
                      <td>{formatMoney(row.teamShare)}</td>
                      <td>{row.approvedJobsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summary.teams.length === 0 && (
              <p className={styles.noData}>{t('common.noData')}</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
