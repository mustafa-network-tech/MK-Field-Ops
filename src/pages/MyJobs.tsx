import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getJobWithDetails } from '../services/jobCalculationService';
import { getJobsForUser } from '../services/jobScopeService';
import { getTeamsForUser } from '../services/teamScopeService';
import { updateJob } from '../services/jobService';
import { formatPriceForUser } from '../utils/priceRules';
import { Card } from '../components/ui/Card';
import type { JobRecord } from '../types';
import styles from './MyJobs.module.css';

const statusKeys: Record<string, string> = {
  draft: 'jobs.draft',
  submitted: 'jobs.submitted',
  approved: 'jobs.approved',
  rejected: 'jobs.rejected',
};

export function MyJobs() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const scopedJobs = getJobsForUser(companyId, user);
  const jobs = scopedJobs.filter((j) => j.createdBy === user?.id);
  const teams = getTeamsForUser(companyId, user);
  const workItems = store.getWorkItems(companyId);
  const getTeamCode = (id: string) => teams.find((t) => t.id === id)?.code ?? id;
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;
  const [actionError, setActionError] = useState('');

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
              <th>{t('jobs.team')}</th>
              <th>{t('jobs.workItem')}</th>
              <th>{t('jobs.quantity')}</th>
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
                  <td>{getTeamCode(job.teamId)}</td>
                  <td>{getWorkItemCode(job.workItemId)}</td>
                  <td>{job.quantity}</td>
                  <td>
                    <span className={styles[`badge_${job.status}`] ?? styles.badge}>{t(statusKeys[job.status])}</span>
                  </td>
                  <td>{details ? formatPriceForUser(details.totalWorkValue, user, 'companyOrTotal') : '–'}</td>
                  <td>{details ? formatPriceForUser(details.teamEarnings, user, 'teamOnly') : '–'}</td>
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
