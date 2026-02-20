import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { exportJobsToExcel, exportDashboardToExcel } from '../services/excelExportService';
import { Card } from '../components/ui/Card';
import styles from './Reports.module.css';

export function Reports() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('reports.title')}</h1>
      <Card>
        <p className={styles.desc}>{t('reports.exportExcel')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={() => exportDashboardToExcel(companyId, user)}>
            {t('dashboard.title')} – Excel
          </button>
          <button type="button" className={styles.primaryBtn} onClick={() => exportJobsToExcel(companyId, user)}>
            {t('nav.myJobs')} – Excel ({t('reports.period')})
          </button>
          <button type="button" className={styles.primaryBtn} onClick={() => exportJobsToExcel(companyId, user, { status: 'approved' })}>
            {t('dashboard.approvedJobs')} – Excel
          </button>
        </div>
      </Card>
    </div>
  );
}
