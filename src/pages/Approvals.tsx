import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getJobsForUser } from '../services/jobScopeService';
import { getTeamsForUser } from '../services/teamScopeService';
import { updateJob } from '../services/jobService';
import { getProjectDisplayKey } from '../utils/projectKey';
import { Card } from '../components/ui/Card';
import type { JobMaterialUsage, MaterialMainType } from '../types';
import styles from './Approvals.module.css';

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

export function Approvals() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const canApproveJobs = user?.role === 'companyManager' || user?.role === 'projectManager';

  const jobs = getJobsForUser(companyId, user)
    .filter((j) => j.status === 'submitted')
    .sort((a, b) => (b.createdAt ?? b.date ?? '').localeCompare(a.createdAt ?? a.date ?? '', undefined, { numeric: true }));
  const teams = getTeamsForUser(companyId, user);
  const workItems = store.getWorkItems(companyId);
  const users = store.getUsers(companyId);
  const stockItems = store.getMaterialStock(companyId);
  const getTeamCode = (id: string) => teams.find((t) => t.id === id)?.code ?? id;
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;
  const getCreatorName = (id: string) => users.find((u) => u.id === id)?.fullName ?? id;
  const getProjectKey = (projectId?: string) => {
    if (!projectId) return '–';
    const p = store.getProject(projectId, companyId);
    return p ? getProjectDisplayKey(p) : '–';
  };
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState<'approved' | 'rejected' | null>(null);

  function formatMaterialUsage(u: JobMaterialUsage, t: (key: string) => string): string {
    const q = `${u.quantity} ${u.quantityUnit === 'm' ? 'm' : t('jobs.material.pcs')}`;
    if (u.isExternal) return `${u.externalDescription ?? t('jobs.material.external')} – ${q} (${t('jobs.material.external')})`;
    const item = stockItems.find((m) => m.id === u.materialStockItemId);
    const typeLabel = item ? t(TYPE_DISPLAY_KEYS[item.mainType]) : '–';
    const name = item ? (item.spoolId ? `${item.name ?? item.capacityLabel} (${item.spoolId})` : (item.name ?? item.capacityLabel ?? '')) : '–';
    return `${typeLabel} — ${name} – ${q} (${u.teamZimmetId ? t('jobs.material.fromZimmet') : t('jobs.material.fromStock')})`;
  }

  const handleApprove = (jobId: string) => {
    setActionError('');
    setSuccessMessage(null);
    const result = updateJob(user ?? undefined, companyId, jobId, { status: 'approved', approvedBy: user!.id });
    if (result.ok) {
      setSuccessMessage('approved');
    } else {
      setActionError(t(result.error));
    }
  };
  const handleReject = (jobId: string) => {
    setActionError('');
    setSuccessMessage(null);
    const result = updateJob(user ?? undefined, companyId, jobId, { status: 'rejected', rejectedBy: user!.id });
    if (result.ok) {
      setSuccessMessage('rejected');
    } else {
      setActionError(t(result.error));
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('approvals.title')}</h1>
      {actionError && <p className={styles.error}>{actionError}</p>}
      {successMessage === 'approved' && <p className={styles.success}>{t('approvals.approvedMessage')}</p>}
      {successMessage === 'rejected' && <p className={styles.successReject}>{t('approvals.rejectedMessage')}</p>}
      <Card title={t('approvals.jobApprovals')}>
        {!canApproveJobs && <p className={styles.muted}>{t('approvals.noPending')}</p>}
        {canApproveJobs && jobs.length === 0 && <p className={styles.muted}>{t('approvals.noPending')}</p>}
        {canApproveJobs && jobs.length > 0 && (
          <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('jobs.date')}</th>
                <th>{t('projects.projectKey')}</th>
                <th>{t('jobs.team')}</th>
                <th>{t('jobs.workItem')}</th>
                <th>{t('jobs.quantity')}</th>
                <th>{t('jobs.materialUsage')}</th>
                <th>{t('jobs.createdBy')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{new Date(job.date).toLocaleDateString()}</td>
                  <td>{getProjectKey(job.projectId)}</td>
                  <td>{getTeamCode(job.teamId)}</td>
                  <td>{getWorkItemCode(job.workItemId)}</td>
                  <td>{job.quantity}</td>
                  <td>
                    {(job.materialUsages?.length ?? 0) > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
                        {job.materialUsages!.map((u, i) => (
                          <li key={i}>{formatMaterialUsage(u, t)}</li>
                        ))}
                      </ul>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td>{getCreatorName(job.createdBy)}</td>
                  <td>
                    <button type="button" className={styles.btnOk} onClick={() => handleApprove(job.id)}>{t('approvals.approve')}</button>
                    <button type="button" className={styles.btnDanger} onClick={() => handleReject(job.id)}>{t('approvals.reject')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}
