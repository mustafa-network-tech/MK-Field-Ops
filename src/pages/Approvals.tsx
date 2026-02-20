import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getJobsForUser } from '../services/jobScopeService';
import { getTeamsForUser } from '../services/teamScopeService';
import { updateJob } from '../services/jobService';
import { Card } from '../components/ui/Card';
import styles from './Approvals.module.css';

export function Approvals() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const canApproveJobs = user?.role === 'companyManager' || user?.role === 'projectManager';

  const jobs = getJobsForUser(companyId, user).filter((j) => j.status === 'submitted');
  const teams = getTeamsForUser(companyId, user);
  const workItems = store.getWorkItems(companyId);
  const users = store.getUsers(companyId);
  const getTeamCode = (id: string) => teams.find((t) => t.id === id)?.code ?? id;
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;
  const getCreatorName = (id: string) => users.find((u) => u.id === id)?.fullName ?? id;
  const [actionError, setActionError] = useState('');

  const handleApprove = (jobId: string) => {
    setActionError('');
    const result = updateJob(user ?? undefined, companyId, jobId, { status: 'approved', approvedBy: user!.id });
    if (!result.ok) setActionError(t(result.error));
  };
  const handleReject = (jobId: string) => {
    setActionError('');
    const result = updateJob(user ?? undefined, companyId, jobId, { status: 'rejected', rejectedBy: user!.id });
    if (!result.ok) setActionError(t(result.error));
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('approvals.title')}</h1>
      {actionError && <p className={styles.error}>{actionError}</p>}
      <Card title={t('approvals.jobApprovals')}>
        {!canApproveJobs && <p className={styles.muted}>{t('approvals.noPending')}</p>}
        {canApproveJobs && jobs.length === 0 && <p className={styles.muted}>{t('approvals.noPending')}</p>}
        {canApproveJobs && jobs.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('jobs.date')}</th>
                <th>{t('jobs.team')}</th>
                <th>{t('jobs.workItem')}</th>
                <th>{t('jobs.quantity')}</th>
                <th>{t('jobs.createdBy')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{new Date(job.date).toLocaleDateString()}</td>
                  <td>{getTeamCode(job.teamId)}</td>
                  <td>{getWorkItemCode(job.workItemId)}</td>
                  <td>{job.quantity}</td>
                  <td>{getCreatorName(job.createdBy)}</td>
                  <td>
                    <button type="button" className={styles.btnOk} onClick={() => handleApprove(job.id)}>{t('approvals.approve')}</button>
                    <button type="button" className={styles.btnDanger} onClick={() => handleReject(job.id)}>{t('approvals.reject')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
