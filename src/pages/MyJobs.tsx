import { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getJobWithDetails } from '../services/jobCalculationService';
import { getJobsForUser } from '../services/jobScopeService';
import { getTeamsForUser } from '../services/teamScopeService';
import { updateJob } from '../services/jobService';
import { formatPriceForUser, formatUnitPriceForUser } from '../utils/priceRules';
import { getProjectDisplayKey } from '../utils/projectKey';
import { getActivePeriod, isDateInPeriod } from '../utils/periodUtils';
import { Card } from '../components/ui/Card';
import type { JobRecord, JobMaterialUsage, MaterialMainType } from '../types';
import styles from './MyJobs.module.css';

function formatPeriodLabelLocale(startStr: string, endStr: string, locale: string): string {
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${s.toLocaleDateString(locale, opts)} – ${e.toLocaleDateString(locale, opts)}`;
}

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
  const [actionError, setActionError] = useState('');
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [modalJobId, setModalJobId] = useState<string | null>(null);

  const myJobsAll = useMemo(() => {
    const scoped = getJobsForUser(companyId, user);
    return scoped
      .filter((j) => j.createdBy === user?.id)
      .sort((a, b) =>
        (b.createdAt ?? b.date ?? '').localeCompare(a.createdAt ?? a.date ?? '', undefined, { numeric: true })
      );
  }, [companyId, user, listRefreshKey]);

  const startDayOfMonth = store.getPayrollPeriodSettings(companyId)?.startDayOfMonth ?? 1;
  const activePeriod = useMemo(() => getActivePeriod(new Date(), startDayOfMonth), [startDayOfMonth]);

  /** Arama ile uygulanan özel aralık; null = yalnızca güncel hakediş dönemi */
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [dateFromDraft, setDateFromDraft] = useState(activePeriod.start);
  const [dateToDraft, setDateToDraft] = useState(activePeriod.end);
  const [rangeError, setRangeError] = useState('');

  useEffect(() => {
    setAppliedCustomRange(null);
    setRangeError('');
    setDateFromDraft(activePeriod.start);
    setDateToDraft(activePeriod.end);
  }, [companyId, activePeriod.start, activePeriod.end]);

  const jobs = useMemo(() => {
    if (appliedCustomRange) {
      const { start, end } = appliedCustomRange;
      return myJobsAll.filter((j) => j.date >= start && j.date <= end);
    }
    return myJobsAll.filter((j) => isDateInPeriod(j.date, activePeriod));
  }, [myJobsAll, appliedCustomRange, activePeriod]);

  const handleSearchRange = () => {
    setRangeError('');
    const a = dateFromDraft.trim();
    const b = dateToDraft.trim();
    if (!a || !b) {
      setRangeError(t('jobs.myJobsRangeRequired'));
      return;
    }
    if (a > b) {
      setRangeError(t('jobs.myJobsRangeOrder'));
      return;
    }
    if (a === activePeriod.start && b === activePeriod.end) {
      setAppliedCustomRange(null);
      return;
    }
    setAppliedCustomRange({ start: a, end: b });
  };

  const handleShowActivePeriod = () => {
    setAppliedCustomRange(null);
    setRangeError('');
    setDateFromDraft(activePeriod.start);
    setDateToDraft(activePeriod.end);
  };
  const teams = getTeamsForUser(companyId, user);
  const workItems = store.getWorkItems(companyId);
  const stockItems = store.getMaterialStock(companyId);
  const getTeamCode = (id: string) => teams.find((t) => t.id === id)?.code ?? id;
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;
  const users = store.getUsers(companyId);
  const getUserName = (id?: string | null) => (id ? users.find((u) => u.id === id)?.fullName ?? id : '–');
  const getProjectKey = (projectId?: string) => {
    if (!projectId) return '–';
    const p = store.getProject(projectId, companyId);
    return p ? getProjectDisplayKey(p) : '–';
  };

  const handleOpenJobDetailModal = (jobId: string) => {
    setModalJobId(jobId);
  };

  function formatMaterialUsage(
    u: JobMaterialUsage,
    t: (key: string, params?: Record<string, string | number>) => string
  ): string {
    const q = `${u.quantity} ${u.quantityUnit === 'm' ? 'm' : t('jobs.material.pcs')}`;
    if (u.isExternal) return `${u.externalDescription ?? t('jobs.material.external')} – ${q} (${t('jobs.material.external')})`;
    let stockId = u.materialStockItemId;
    if (!stockId && u.teamZimmetId) {
      const alloc = store.getTeamMaterialAllocations(companyId).find((a) => a.id === u.teamZimmetId);
      stockId = alloc?.materialStockItemId;
    }
    const item = stockId ? stockItems.find((m) => m.id === stockId) : undefined;
    const typeLabel = item ? t(TYPE_DISPLAY_KEYS[item.mainType]) : '–';
    const name = item
      ? item.spoolId
        ? `${item.name ?? item.capacityLabel} (${item.spoolId})`
        : (item.name ?? item.capacityLabel ?? '')
      : stockId
        ? t('jobs.material.zimmetUsageNoStockDetail', { id: stockId.slice(0, 8) })
        : '–';
    return `${typeLabel} — ${name} – ${q} (${u.teamZimmetId ? t('jobs.material.fromZimmet') : t('jobs.material.fromStock')})`;
  }

  const handleSubmitForApproval = async (job: JobRecord) => {
    setActionError('');
    const result = await updateJob(user ?? undefined, companyId, job.id, { status: 'submitted' });
    if (result.ok) {
      setListRefreshKey((k) => k + 1);
    } else {
      setActionError(t(result.error));
    }
  };

  const activeLabel = formatPeriodLabelLocale(activePeriod.start, activePeriod.end, locale);
  const shownLabel = appliedCustomRange
    ? formatPeriodLabelLocale(appliedCustomRange.start, appliedCustomRange.end, locale)
    : activeLabel;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('nav.myJobs')}</h1>
      <div className={styles.periodBanner}>
        <p className={styles.periodBannerLabel}>
          {!appliedCustomRange ? (
            <>
              <span className={styles.periodBadge}>{t('jobs.myJobsListCurrentPeriod')}</span>
              <span className={styles.periodBannerRange}>{activeLabel}</span>
            </>
          ) : (
            <>
              <span className={styles.periodBannerText}>{t('jobs.myJobsListShowingRange')}</span>
              <span className={styles.periodBannerRange}>{shownLabel}</span>
            </>
          )}
        </p>
        {appliedCustomRange && (
          <button type="button" className={styles.backToCurrentBtn} onClick={handleShowActivePeriod}>
            {t('jobs.myJobsShowActivePeriod')}
          </button>
        )}
      </div>

      <div className={styles.dateFilterCard}>
        <p className={styles.dateFilterTitle}>{t('jobs.myJobsDateFilterTitle')}</p>
        <div className={styles.dateFilterRow}>
          <div className={styles.dateField}>
            <label htmlFor="myjobs-date-from">{t('jobs.myJobsDateFrom')}</label>
            <input
              id="myjobs-date-from"
              type="date"
              className={styles.dateInput}
              value={dateFromDraft}
              onChange={(e) => setDateFromDraft(e.target.value)}
            />
          </div>
          <div className={styles.dateField}>
            <label htmlFor="myjobs-date-to">{t('jobs.myJobsDateTo')}</label>
            <input
              id="myjobs-date-to"
              type="date"
              className={styles.dateInput}
              value={dateToDraft}
              onChange={(e) => setDateToDraft(e.target.value)}
            />
          </div>
          <button type="button" className={styles.searchRangeBtn} onClick={handleSearchRange}>
            {t('jobs.myJobsSearchRange')}
          </button>
        </div>
        {rangeError && <p className={styles.rangeError}>{rangeError}</p>}
      </div>

      {actionError && <p className={styles.error}>{actionError}</p>}
      <Card key={listRefreshKey}>
        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('jobs.date')}</th>
              <th>{t('projects.projectKey')}</th>
              <th>{t('jobs.team')}</th>
              <th>{t('jobs.workItem')}</th>
              <th>{t('jobs.quantity')}</th>
              <th>{t('jobs.unitPrice')}</th>
              <th>{t('jobs.materialUsage')}</th>
              <th>{t('jobs.status')}</th>
              <th>{t('jobs.totalWorkValue')}</th>
              <th>{t('jobs.teamEarnings')}</th>
              <th>{t('jobs.jobCode')}</th>
              <th className={styles.actionsCol} aria-label={t('common.actions')}></th>
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
                  <td>
                    {details
                      ? formatUnitPriceForUser(details.unitPrice, user, details.teamPercentage, locale)
                      : '–'}
                  </td>
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
                    <span className={styles[`badge_${job.status}`] ?? styles.badge}>
                      {job.status === 'submitted' ? t('jobs.waitingForApproval') : t(statusKeys[job.status])}
                    </span>
                    {job.status === 'approved' && job.approvedBy && (
                      <div className={styles.approverLine}>
                        {t('jobs.approvedBy')}: {getUserName(job.approvedBy)}
                      </div>
                    )}
                    {job.status === 'rejected' && job.rejectedBy && (
                      <div className={styles.approverLine}>
                        {t('jobs.rejectedBy')}: {getUserName(job.rejectedBy)}
                      </div>
                    )}
                  </td>
                  <td>{details ? formatPriceForUser(details.totalWorkValue, user, 'companyOrTotal', locale) : '–'}</td>
                  <td>{details ? formatPriceForUser(details.teamEarnings, user, 'teamOnly', locale) : '–'}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.jobCodeBtn}
                      onClick={() => handleOpenJobDetailModal(job.id)}
                      title={t('jobs.jobCodeModalTitle')}
                    >
                      #{job.id.slice(0, 8)}
                    </button>
                  </td>
                  <td className={styles.actionsCol}>
                    {job.status === 'draft' && (
                      <button type="button" className={styles.smallBtn} onClick={() => handleSubmitForApproval(job)}>
                        {t('jobs.submitForApproval')}
                      </button>
                    )}
                    {job.status === 'submitted' && (
                      <span className={styles.waitingLabel}>{t('jobs.waitingForApproval')}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {jobs.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
      </Card>

      {modalJobId && (() => {
        const modalJob = myJobsAll.find((j) => j.id === modalJobId);
        return (
          <div className={styles.modalOverlay} onClick={() => setModalJobId(null)} role="dialog" aria-modal="true" aria-labelledby="job-detail-modal-title">
            <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2 id="job-detail-modal-title" className={styles.modalTitle}>
                  {t('jobs.jobDetailModalTitle')} #{modalJobId.slice(0, 8)}
                </h2>
                <button type="button" className={styles.modalClose} onClick={() => setModalJobId(null)} aria-label={t('common.close')}>
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                {modalJob?.notes ? (
                  <div className={styles.modalNoteSection}>
                    <strong>{t('jobs.notes')}</strong>
                    <p className={styles.modalNoteText}>{modalJob.notes}</p>
                  </div>
                ) : null}
                {(() => {
                  const photos = modalJob?.notePhotos?.length ? modalJob.notePhotos : (modalJob?.notePhoto ? [modalJob.notePhoto] : []);
                  return photos.length > 0 ? (
                    <div className={styles.modalPhotoSection}>
                      <strong>{t('jobs.photo')}</strong>
                      <div className={styles.modalPhotoList}>
                        {photos.map((src, i) => (
                          <img key={i} src={src} alt="" className={styles.modalPhotoImg} />
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
                {!modalJob?.notes && !(modalJob?.notePhotos?.length || modalJob?.notePhoto) && (
                  <p className={styles.modalPlaceholder}>{t('jobs.jobDetailModalPlaceholder')}</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
