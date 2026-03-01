import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getJobWithDetails } from '../services/jobCalculationService';
import { getJobsForUser } from '../services/jobScopeService';
import { getTeamsForUser } from '../services/teamScopeService';
import { updateJob } from '../services/jobService';
import { formatPriceForUser } from '../utils/priceRules';
import { getProjectDisplayKey } from '../utils/projectKey';
import { Card } from '../components/ui/Card';
import type { JobRecord, JobMaterialUsage, MaterialMainType } from '../types';
import styles from './MyJobs.module.css';

const TYPE_DISPLAY_KEYS: Record<MaterialMainType, string> = {
  direk: 'materials.typeDisplayDirek',
  kablo_ic: 'materials.typeDisplayKabloIc',
  kablo_yeraltı: 'materials.typeDisplayKabloYeralti',
  kablo_havai: 'materials.typeDisplayKabloHavai',
  boru: 'materials.typeDisplayBoru',
  fiber_bina_kutusu: 'materials.typeDisplayFiberKutusu',
  ofsd: 'materials.typeDisplayOFSD',
  sonlandirma_paneli: 'materials.typeDisplaySonlandirmaPaneli',
  daire_sonlandirma_kutusu: 'materials.typeDisplayDaireKutusu',
  menhol: 'materials.typeDisplayMenhol',
  ek_odasi: 'materials.typeDisplayEkOdasi',
  koruyucu_fider_borusu: 'materials.typeDisplayKoruyucuFider',
  custom: 'materials.typeDisplayCustom',
};

const statusKeys: Record<string, string> = {
  draft: 'jobs.draft',
  submitted: 'jobs.submitted',
  approved: 'jobs.approved',
  rejected: 'jobs.rejected',
};

export function MyJobs() {
  const { t, locale } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const scopedJobs = getJobsForUser(companyId, user);
  const jobs = scopedJobs
    .filter((j) => j.createdBy === user?.id)
    .sort((a, b) => (b.createdAt ?? b.date ?? '').localeCompare(a.createdAt ?? a.date ?? '', undefined, { numeric: true }));
  const teams = getTeamsForUser(companyId, user);
  const workItems = store.getWorkItems(companyId);
  const stockItems = store.getMaterialStock(companyId);
  const getTeamCode = (id: string) => teams.find((t) => t.id === id)?.code ?? id;
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;
  const getProjectKey = (projectId?: string) => {
    if (!projectId) return '–';
    const p = store.getProject(projectId);
    return p ? getProjectDisplayKey(p) : '–';
  };
  const [actionError, setActionError] = useState('');

  function formatMaterialUsage(u: JobMaterialUsage, t: (key: string) => string): string {
    const q = `${u.quantity} ${u.quantityUnit === 'm' ? 'm' : t('jobs.material.pcs')}`;
    if (u.isExternal) return `${u.externalDescription ?? t('jobs.material.external')} – ${q} (${t('jobs.material.external')})`;
    const item = stockItems.find((m) => m.id === u.materialStockItemId);
    const typeLabel = item ? t(TYPE_DISPLAY_KEYS[item.mainType]) : '–';
    const name = item ? (item.spoolId ? `${item.name ?? item.capacityLabel} (${item.spoolId})` : (item.name ?? item.capacityLabel ?? '')) : '–';
    return `${typeLabel} — ${name} – ${q} (${u.teamZimmetId ? t('jobs.material.fromZimmet') : t('jobs.material.fromStock')})`;
  }

  const handleSubmitForApproval = (job: JobRecord) => {
    setActionError('');
    const result = updateJob(user ?? undefined, companyId, job.id, { status: 'submitted' });
    if (!result.ok) {
      setActionError(t(result.error));
      return;
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('nav.myJobs')}</h1>
      {actionError && <p className={styles.error}>{actionError}</p>}
      <Card>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('jobs.date')}</th>
              <th>{t('projects.projectKey')}</th>
              <th>{t('jobs.team')}</th>
              <th>{t('jobs.workItem')}</th>
              <th>{t('jobs.quantity')}</th>
              <th>{t('jobs.materialUsage')}</th>
              <th>{t('jobs.status')}</th>
              <th>{t('jobs.totalWorkValue')}</th>
              <th>{t('jobs.teamEarnings')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const details = job.status === 'approved' ? getJobWithDetails(job, companyId) : null;
              return (
                <tr key={job.id}>
                  <td>{new Date(job.date).toLocaleDateString()}</td>
                  <td>{getProjectKey(job.projectId)}</td>
                  <td>{getTeamCode(job.teamId)}</td>
                  <td>{getWorkItemCode(job.workItemId)}</td>
                  <td>{job.quantity}</td>
                  <td className={styles.materialCell}>
                    {(job.materialUsages?.length ?? 0) > 0 ? (
                      <ul className={styles.materialUsageList}>
                        {job.materialUsages!.map((u, i) => (
                          <li key={i}>{formatMaterialUsage(u, t)}</li>
                        ))}
                      </ul>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td>
                    <span className={styles[`badge_${job.status}`] ?? styles.badge}>{t(statusKeys[job.status])}</span>
                  </td>
                  <td>{details ? formatPriceForUser(details.totalWorkValue, user, 'companyOrTotal', locale) : '–'}</td>
                  <td>{details ? formatPriceForUser(details.teamEarnings, user, 'teamOnly', locale) : '–'}</td>
                  <td>
                    {job.status === 'draft' && (
                      <button type="button" className={styles.smallBtn} onClick={() => handleSubmitForApproval(job)}>
                        {t('jobs.submitForApproval')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
      </Card>
    </div>
  );
}
