import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getTeamForUser } from '../services/teamScopeService';
import { getTeamDetailSummary } from '../services/teamDetailService';
import { formatPriceForUser } from '../utils/priceRules';
import { Card } from '../components/ui/Card';
import styles from './TeamDetail.module.css';

export function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';

  const teamResult = teamId && user ? getTeamForUser(teamId, user) : { ok: false as const, statusCode: 404 as const };
  const team = teamResult.ok ? teamResult.team : undefined;
  const workItems = store.getWorkItems(companyId);
  const detail = teamId && user ? getTeamDetailSummary(companyId, teamId, user) : null;

  if (!teamId || !team) {
    const is403 = !teamResult.ok && teamResult.statusCode === 403;
    return (
      <div className={styles.page}>
        <p>{is403 ? t('errors.forbidden') : t('common.noData')}</p>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/management')}>{t('common.back')}</button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={styles.page}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/management')}>{t('common.back')}</button>
        <p className={styles.noData}>{t('common.noData')}</p>
      </div>
    );
  }

  const isAdmin = detail.role === 'companyManager' || detail.role === 'projectManager';
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;
  const maxTeam = Math.max(
    isAdmin ? (detail.weekly as { team: number }).team : detail.weekly.team,
    isAdmin ? (detail.monthly as { team: number }).team : detail.monthly.team,
    1
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/management')}>{t('common.back')}</button>
        <h1 className={styles.title}>{team.code} – {t('teamDetail.title')}</h1>
      </div>

      {/* Top stats: admin = 3 (Gross / Team / Company) + jobs/pending/approved; TL = Team + jobs/pending/approved */}
      <div className={styles.statsGrid}>
        {isAdmin ? (
          <>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>{t('jobs.totalWorkValue')}</span>
              <span className={styles.statValue}>{detail.grossTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>{t('jobs.teamEarnings')}</span>
              <span className={styles.statValue}>{detail.teamTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>{t('jobs.companyShare')}</span>
              <span className={styles.statValue}>{detail.companyTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
            </div>
          </>
        ) : (
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>{t('teamDetail.totalEarnings')}</span>
            <span className={styles.statValue}>{formatPriceForUser(detail.teamTotal, user, 'teamOnly')}</span>
          </div>
        )}
        <div className={styles.statBlock}>
          <span className={styles.statLabel}>{t('teamDetail.totalJobs')}</span>
          <span className={styles.statValue}>{detail.totalJobs}</span>
        </div>
        <div className={styles.statBlock}>
          <span className={styles.statLabel}>{t('teamDetail.pendingApprovals')}</span>
          <span className={styles.statValue}>{detail.pendingCount}</span>
        </div>
        <div className={styles.statBlock}>
          <span className={styles.statLabel}>{t('teamDetail.approvedJobs')}</span>
          <span className={styles.statValue}>{detail.approvedCount}</span>
        </div>
      </div>

      <Card title={t('teamDetail.performance')}>
        <div className={styles.barSection}>
          <div className={styles.barRow}>
            <span className={styles.barLabel}>{t('reports.weekly')}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${((isAdmin ? (detail.weekly as { team: number }).team : detail.weekly.team) / maxTeam) * 100}%` }} />
            </div>
            <span className={styles.barValue}>
              {formatPriceForUser(isAdmin ? (detail.weekly as { team: number }).team : detail.weekly.team, user, 'teamOnly')}
            </span>
          </div>
          <div className={styles.barRow}>
            <span className={styles.barLabel}>{t('reports.monthly')}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${((isAdmin ? (detail.monthly as { team: number }).team : detail.monthly.team) / maxTeam) * 100}%` }} />
            </div>
            <span className={styles.barValue}>
              {formatPriceForUser(isAdmin ? (detail.monthly as { team: number }).team : detail.monthly.team, user, 'teamOnly')}
            </span>
          </div>
        </div>
      </Card>

      <div className={styles.summaryRow}>
        {isAdmin ? (
          <>
            <Card title={t('teamDetail.weeklySummary')}>
              <p className={styles.meta}>{t('jobs.totalWorkValue')}: {detail.weekly.gross.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
              <p className={styles.meta}>{t('jobs.teamEarnings')}: {detail.weekly.team.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
              <p className={styles.meta}>{t('jobs.companyShare')}: {detail.weekly.company.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
            </Card>
            <Card title={t('teamDetail.monthlySummary')}>
              <p className={styles.meta}>{t('jobs.totalWorkValue')}: {detail.monthly.gross.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
              <p className={styles.meta}>{t('jobs.teamEarnings')}: {detail.monthly.team.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
              <p className={styles.meta}>{t('jobs.companyShare')}: {detail.monthly.company.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
            </Card>
          </>
        ) : (
          <>
            <Card title={t('teamDetail.weeklySummary')}>
              <p className={styles.summaryValue}>{formatPriceForUser(detail.weekly.team, user, 'teamOnly')}</p>
            </Card>
            <Card title={t('teamDetail.monthlySummary')}>
              <p className={styles.summaryValue}>{formatPriceForUser(detail.monthly.team, user, 'teamOnly')}</p>
            </Card>
          </>
        )}
      </div>

      <Card title={t('teamDetail.jobBreakdown')}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('jobs.date')}</th>
                <th>{t('jobs.workItem')}</th>
                <th>{t('jobs.quantity')}</th>
                {isAdmin && (
                  <>
                    <th>{t('jobs.totalWorkValue')}</th>
                    <th>{t('jobs.teamEarnings')}</th>
                    <th>{t('jobs.companyShare')}</th>
                  </>
                )}
                {!isAdmin && <th>{t('jobs.teamEarnings')}</th>}
              </tr>
            </thead>
            <tbody>
              {isAdmin
                ? detail.jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{new Date(j.date).toLocaleDateString()}</td>
                      <td>{getWorkItemCode(j.workItemId)}</td>
                      <td>{j.quantity}</td>
                      <td>{j.gross.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                      <td>{j.team.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                      <td>{j.company.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                    </tr>
                  ))
                : detail.jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{new Date(j.date).toLocaleDateString()}</td>
                      <td>{getWorkItemCode(j.workItemId)}</td>
                      <td>{j.quantity}</td>
                      <td>{formatPriceForUser(j.team, user, 'teamOnly')}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {detail.jobs.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
      </Card>
    </div>
  );
}
