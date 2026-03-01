import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { getDashboardSummary } from '../services/dashboardSummaryService';
import { formatPriceForUser } from '../utils/priceRules';
import { formatCurrency } from '../utils/formatLocale';
import { Card } from '../components/ui/Card';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const { t, locale } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const summary = getDashboardSummary(companyId, user);

  if (!summary) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('dashboard.title')}</h1>
        <p className={styles.noData}>{t('common.noData')}</p>
      </div>
    );
  }

  const isAdmin = summary.role === 'companyManager' || summary.role === 'projectManager';

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('dashboard.title')}</h1>
      {summary.activePayrollPeriod?.label && (
        <p className={styles.meta} style={{ marginBottom: '1rem' }}>
          {t('settings.activePeriodLabel')}: {summary.activePayrollPeriod.label}
        </p>
      )}

      {/* Top cards: admin/pm = 3 (Gross / Team / Company), TL = 1 (Team only) */}
      <div className={styles.grid}>
        {isAdmin ? (
          <>
            <Card title={t('jobs.totalWorkValue')}>
              <p className={styles.bigNumber}>{formatCurrency(summary.grossTotal, locale)}</p>
              <p className={styles.meta}>{summary.approvedCount} {t('dashboard.approvedJobs').toLowerCase()}</p>
            </Card>
            <Card title={t('jobs.teamEarnings')}>
              <p className={styles.bigNumber}>{formatCurrency(summary.teamTotal, locale)}</p>
            </Card>
            <Card title={t('jobs.companyShare')}>
              <p className={styles.bigNumber}>{formatCurrency(summary.companyTotal, locale)}</p>
            </Card>
          </>
        ) : (
          <Card title={t('jobs.teamEarnings')}>
            <p className={styles.bigNumber}>{formatPriceForUser(summary.teamTotal, user, 'teamOnly', locale)}</p>
            <p className={styles.meta}>{summary.approvedCount} {t('dashboard.approvedJobs').toLowerCase()}</p>
          </Card>
        )}
      </div>

      <div className={styles.grid}>
        <Card title={t('dashboard.pendingApprovals')}>
          <p className={styles.bigNumber}>{summary.pendingCount}</p>
          <p className={styles.meta}>{t('jobs.submitted')}</p>
        </Card>
        <Card title={t('dashboard.approvedJobs')}>
          <p className={styles.bigNumber}>{summary.approvedCount}</p>
        </Card>
      </div>

      {/* Weekly / Monthly summary: admin = 3 amounts each, TL = team only */}
      {isAdmin ? (
        <div className={styles.grid}>
          <Card title={t('dashboard.weeklyTotal')}>
            <p className={styles.meta}>{t('jobs.totalWorkValue')}: {formatCurrency(summary.weekly.gross_total, locale)}</p>
            <p className={styles.meta}>{t('jobs.teamEarnings')}: {formatCurrency(summary.weekly.team_total, locale)}</p>
            <p className={styles.meta}>{t('jobs.companyShare')}: {formatCurrency(summary.weekly.company_total, locale)}</p>
            <p className={styles.meta}>{summary.weekly.count} jobs</p>
          </Card>
          <Card title={t('dashboard.monthlyTotal')}>
            <p className={styles.meta}>{t('jobs.totalWorkValue')}: {formatCurrency(summary.monthly.gross_total, locale)}</p>
            <p className={styles.meta}>{t('jobs.teamEarnings')}: {formatCurrency(summary.monthly.team_total, locale)}</p>
            <p className={styles.meta}>{t('jobs.companyShare')}: {formatCurrency(summary.monthly.company_total, locale)}</p>
            <p className={styles.meta}>{summary.monthly.count} jobs</p>
          </Card>
        </div>
      ) : (
        <div className={styles.grid}>
          <Card title={t('dashboard.weeklyTotal')}>
            <p className={styles.bigNumber}>{formatPriceForUser(summary.weekly.team_total, user, 'teamOnly', locale)}</p>
            <p className={styles.meta}>{summary.weekly.count} jobs</p>
          </Card>
          <Card title={t('dashboard.monthlyTotal')}>
            <p className={styles.bigNumber}>{formatPriceForUser(summary.monthly.team_total, user, 'teamOnly', locale)}</p>
            <p className={styles.meta}>{summary.monthly.count} jobs</p>
          </Card>
        </div>
      )}

      {/* Team summary: admin = table with Gross, Team, Company columns; TL = Team only */}
      <Card title={t('dashboard.teamEarningsSummary')}>
        {isAdmin ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('teams.teamCode')}</th>
                  <th>{t('jobs.totalWorkValue')}</th>
                  <th>{t('jobs.teamEarnings')}</th>
                  <th>{t('jobs.companyShare')}</th>
                  <th>{t('dashboard.approvedJobs')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.teamSummary.map((row) => (
                  <tr key={row.code}>
                    <td><strong>{row.code}</strong></td>
                    <td>{formatCurrency(row.gross, locale)}</td>
                    <td>{formatCurrency(row.team, locale)}</td>
                    <td>{formatCurrency(row.company, locale)}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className={styles.list}>
            {summary.teamSummary.map((row) => (
              <li key={row.code}>
                <strong>{row.code}</strong>: {formatPriceForUser(row.team, user, 'teamOnly', locale)} ({row.count} jobs)
              </li>
            ))}
            {summary.teamSummary.length === 0 && <li className={styles.noData}>{t('common.noData')}</li>}
          </ul>
        )}
        {isAdmin && summary.teamSummary.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
      </Card>
    </div>
  );
}
