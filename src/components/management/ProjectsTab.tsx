import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { getProjectDisplayKey } from '../../utils/projectKey';
import { upsertCampaign, upsertProject } from '../../services/supabaseSyncService';
import { Card } from '../ui/Card';
import type { MaterialMainType, Project, ProjectStatus } from '../../types';
import styles from './ManagementTabs.module.css';

const PROJECT_YEAR_MIN = 2000;
const PROJECT_YEAR_MAX = 2100;
const LIST_FILTERS: ProjectStatus[] = ['ACTIVE', 'COMPLETED', 'ARCHIVED'];

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

function normalizeExternalInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

const defaultForm = {
  campaignId: '',
  projectYear: '',
  externalProjectId: '',
  receivedDate: new Date().toISOString().slice(0, 10),
  name: '',
  description: '',
};

export function ProjectsTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const campaigns = store.getCampaigns(companyId);
  const allProjects = store.getProjects(companyId);
  const [listFilter, setListFilter] = useState<ProjectStatus>('ACTIVE');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const projectsByStatus = listFilter ? allProjects.filter((p) => p.status === listFilter) : allProjects;
  const projectsInSelectedCampaign = selectedCampaignId
    ? projectsByStatus.filter((p) => p.campaignId === selectedCampaignId)
    : [];

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [error, setError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterWorkItemId, setFilterWorkItemId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [modalJobId, setModalJobId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProjectId) {
      setFilterTeamId('');
      setFilterWorkItemId('');
      setFilterStartDate('');
      setFilterEndDate('');
    }
  }, [selectedProjectId]);

  const projectKeyPreview =
    form.projectYear.trim() && form.externalProjectId.trim()
      ? `${form.projectYear.trim()}-${normalizeExternalInput(form.externalProjectId) || form.externalProjectId.trim()}`
      : '';

  const canEditCatalog = user?.role === 'companyManager' || user?.role === 'projectManager';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const yearNum = parseInt(form.projectYear, 10);
    if (!Number.isInteger(yearNum) || yearNum < PROJECT_YEAR_MIN || yearNum > PROJECT_YEAR_MAX) {
      setError('projects.projectYearInvalid');
      return;
    }
    const external = normalizeExternalInput(form.externalProjectId);
    if (!external) {
      setError('projects.projectExternalIdEmpty');
      return;
    }
    if (!form.campaignId) {
      setError('validation.required');
      return;
    }
    const receivedDate = form.receivedDate?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(form.receivedDate) ? form.receivedDate : new Date().toISOString().slice(0, 10);
    try {
      if (editing) {
        const updated = store.updateProject(editing.id, {
          campaignId: form.campaignId,
          projectYear: yearNum,
          externalProjectId: external,
          receivedDate,
          name: form.name.trim() || undefined,
          description: form.description.trim() || undefined,
        });
        if (updated) upsertProject(updated).catch(() => {});
        setEditing(null);
      } else {
        const added = store.addProject({
          companyId,
          campaignId: form.campaignId,
          projectYear: yearNum,
          externalProjectId: external,
          receivedDate,
          name: form.name.trim() || undefined,
          description: form.description.trim() || undefined,
          status: 'ACTIVE',
          createdBy: user?.id ?? '',
        });
        upsertProject(added).catch(() => {});
        setShowForm(false);
      }
      setForm(defaultForm);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'PROJECT_KEY_EXISTS') setError('projects.projectKeyExists');
      else if (msg === 'PROJECT_YEAR_INVALID') setError('projects.projectYearInvalid');
      else if (msg === 'PROJECT_EXTERNAL_ID_EMPTY') setError('projects.projectExternalIdEmpty');
      else setError('messages.error');
    }
  };

  const handleAddCampaign = () => {
    const name = newCampaignName.trim();
    if (!name) return;
    const c = store.addCampaign({ companyId, name });
    upsertCampaign(c).catch(() => {});
    setForm((f) => ({ ...f, campaignId: c.id }));
    setNewCampaignName('');
    setShowNewCampaign(false);
  };

  const handleArchive = (p: Project) => {
    setError('');
    try {
      const updated = store.updateProject(p.id, { status: 'ARCHIVED' });
      if (updated) upsertProject(updated).catch(() => {});
    } catch {
      setError('messages.error');
    }
  };

  const handleActivate = (p: Project) => {
    setError('');
    try {
      const updated = store.updateProject(p.id, { status: 'ACTIVE' });
      if (updated) upsertProject(updated).catch(() => {});
    } catch {
      setError('messages.error');
    }
  };

  const handleMarkCompleted = () => {
    if (!selectedProjectId || !user) return;
    setCompleteError('');
    const projectJobs = store.getJobs(companyId).filter((j) => j.projectId === selectedProjectId);
    const pending = projectJobs.filter((j) => j.status === 'submitted');
    if (pending.length > 0) {
      setCompleteError('projects.cannotCompletePendingApprovals');
      return;
    }
    const completed = store.completeProject(selectedProjectId, user.id);
    if (completed) upsertProject(completed).catch(() => {});
    setConfirmCompleteOpen(false);
    setSelectedProjectId(null);
  };

  const getCampaignName = (campaignId: string): string => {
    const c = store.getCampaign(campaignId, companyId);
    return c?.name ?? campaignId;
  };

  const selectedProject = selectedProjectId ? store.getProject(selectedProjectId, companyId) : null;
  const projectJobsAll = selectedProjectId
    ? store.getJobs(companyId).filter((j) => j.projectId === selectedProjectId)
    : [];
  const hasPendingApprovals = projectJobsAll.some((j) => j.status === 'submitted');
  const projectJobsApproved = projectJobsAll
    .filter((j) => j.status === 'approved')
    .sort((a, b) => (b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
  const teams = store.getTeams(companyId);
  const users = store.getUsers(companyId);
  const workItems = store.getWorkItems(companyId);
  const stockItems = store.getMaterialStock(companyId);
  const allocationsAll = store.getTeamMaterialAllocations(companyId);
  const getTeamCode = (id: string) => teams.find((t) => t.id === id)?.code ?? id;
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;
  const getWorkItemLabel = (id: string) => {
    const w = workItems.find((x) => x.id === id);
    if (!w) return id;
    const name = (w.description ?? '').trim();
    return name ? `${name} – ${w.code}` : w.code;
  };
  const getUserName = (id: string | undefined | null) =>
    id ? users.find((u) => u.id === id)?.fullName ?? id : '–';

  const zimmetIdToStockId = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of allocationsAll) m.set(a.id, a.materialStockItemId);
    return m;
  }, [allocationsAll]);

  const teamIdsInProject = Array.from(new Set(projectJobsApproved.map((j) => j.teamId)));
  const workItemIdsInProject = Array.from(new Set(projectJobsApproved.map((j) => j.workItemId)));

  const projectJobsFiltered = projectJobsApproved.filter((j) => {
    if (filterTeamId && j.teamId !== filterTeamId) return false;
    if (filterWorkItemId && j.workItemId !== filterWorkItemId) return false;
    if (filterStartDate && j.date < filterStartDate) return false;
    if (filterEndDate && j.date > filterEndDate) return false;
    return true;
  });

  const projectMaterialSummary = useMemo(() => {
    type Row = {
      key: string;
      label: string;
      unit: 'm' | 'pcs';
      totalQty: number;
      source: 'zimmet' | 'external';
    };
    const byKey = new Map<string, Row>();

    const addAgg = (row: Row) => {
      const existing = byKey.get(row.key);
      if (existing) existing.totalQty += row.totalQty;
      else byKey.set(row.key, row);
    };

    const jobsForMaterials = projectJobsFiltered;
    for (const job of jobsForMaterials) {
      const usages = job.materialUsages ?? [];
      for (const u of usages) {
        const unit = u.quantityUnit;
        if (u.isExternal) {
          const desc = (u.externalDescription ?? t('jobs.material.external')).trim();
          addAgg({
            key: `external:${desc}:${unit}`,
            label: `${desc} (${t('jobs.material.external')})`,
            unit,
            totalQty: u.quantity,
            source: 'external',
          });
          continue;
        }

        const stockId =
          (u.materialStockItemId ?? null) ||
          (u.teamZimmetId ? (zimmetIdToStockId.get(u.teamZimmetId) ?? null) : null);
        if (!stockId) continue;

        const item = stockItems.find((m) => m.id === stockId) ?? null;
        const typeLabel = item ? t(TYPE_DISPLAY_KEYS[item.mainType]) : '–';
        const namePart = item
          ? (item.spoolId ? `${item.name ?? item.capacityLabel} (${item.spoolId})` : (item.name ?? item.capacityLabel ?? item.id))
          : stockId;
        const label = item ? `${typeLabel} — ${namePart}` : stockId;

        addAgg({
          key: `stock:${stockId}:${unit}`,
          label,
          unit,
          totalQty: u.quantity,
          source: 'zimmet',
        });
      }
    }

    return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [projectJobsFiltered, stockItems, t, zimmetIdToStockId]);

  const projectMaterialRowsByJob = useMemo(() => {
    type Row = {
      key: string;
      jobId: string;
      date: string;
      approvedAt?: string | null;
      teamId: string;
      workItemId: string;
      materialLabel: string;
      unit: 'm' | 'pcs';
      qty: number;
    };
    const rows: Row[] = [];

    for (const job of projectJobsFiltered) {
      const usages = job.materialUsages ?? [];
      for (const u of usages) {
        const unit = u.quantityUnit;
        if (u.isExternal) {
          const desc = (u.externalDescription ?? t('jobs.material.external')).trim();
          rows.push({
            key: `${job.id}:external:${desc}:${unit}:${u.quantity}`,
            jobId: job.id,
            date: job.date,
            approvedAt: job.approvedAt ?? null,
            teamId: job.teamId,
            workItemId: job.workItemId,
            materialLabel: `${desc} (${t('jobs.material.external')})`,
            unit,
            qty: u.quantity,
          });
          continue;
        }

        const stockId =
          (u.materialStockItemId ?? null) ||
          (u.teamZimmetId ? (zimmetIdToStockId.get(u.teamZimmetId) ?? null) : null);
        const item = stockId ? (stockItems.find((m) => m.id === stockId) ?? null) : null;
        const typeLabel = item ? t(TYPE_DISPLAY_KEYS[item.mainType]) : '–';
        const namePart = item
          ? (item.spoolId ? `${item.name ?? item.capacityLabel} (${item.spoolId})` : (item.name ?? item.capacityLabel ?? item.id))
          : (stockId ?? '–');
        const materialLabel = item ? `${typeLabel} — ${namePart}` : (stockId ?? '–');

        rows.push({
          key: `${job.id}:stock:${stockId ?? '–'}:${unit}:${u.quantity}`,
          jobId: job.id,
          date: job.date,
          approvedAt: job.approvedAt ?? null,
          teamId: job.teamId,
          workItemId: job.workItemId,
          materialLabel,
          unit,
          qty: u.quantity,
        });
      }
    }

    return rows.sort((a, b) => (b.date.localeCompare(a.date) || (a.materialLabel.localeCompare(b.materialLabel))));
  }, [projectJobsFiltered, stockItems, t, zimmetIdToStockId]);

  if (selectedProject && selectedProjectId) {
    return (
      <Card>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              setSelectedProjectId(null);
              setCompleteError('');
            }}
          >
            {t('projects.backToList')}
          </button>
        </div>
        {completeError && <p className={styles.saveError}>{t(completeError)}</p>}
        <div className={styles.detailSection}>
          <h3 className={styles.sectionTitle}>{getProjectDisplayKey(selectedProject)}</h3>
          <dl className={styles.detailList}>
            <dt>{t('projects.projectKey')}</dt>
            <dd>{getProjectDisplayKey(selectedProject)}</dd>
            <dt>{t('campaigns.campaign')}</dt>
            <dd>{getCampaignName(selectedProject.campaignId)}</dd>
            <dt>{t('projects.receivedDate')}</dt>
            <dd>{selectedProject.receivedDate ? new Date(selectedProject.receivedDate).toLocaleDateString() : '–'}</dd>
            <dt>{t('projects.status')}</dt>
            <dd>{t(`projects.status_${selectedProject.status}`)}</dd>
            {selectedProject.completedAt && (
              <>
                <dt>{t('projects.completedAt')}</dt>
                <dd>{new Date(selectedProject.completedAt).toLocaleString()}</dd>
              </>
            )}
            {selectedProject.description && (
              <>
                <dt>{t('projects.description')}</dt>
                <dd>{selectedProject.description}</dd>
              </>
            )}
          </dl>
        </div>
        {canEditCatalog && selectedProject.status === 'ACTIVE' && (
          <div className={styles.formActions} style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setConfirmCompleteOpen(true)}
              disabled={hasPendingApprovals}
              title={hasPendingApprovals ? t('projects.cannotCompletePendingApprovals') : ''}
            >
              {t('projects.markProjectCompleted')}
            </button>
          </div>
        )}
        {confirmCompleteOpen && (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className={styles.modal}>
              <p>{t('projects.confirmMarkCompleted')}</p>
              <div className={styles.formActions}>
                <button type="button" className={styles.primaryBtn} onClick={handleMarkCompleted}>{t('common.yes')}</button>
                <button type="button" className={styles.secondaryBtn} onClick={() => setConfirmCompleteOpen(false)}>{t('common.no')}</button>
              </div>
            </div>
          </div>
        )}
        {canEditCatalog && (
          <>
            <h4 className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>{t('projects.projectActivityLabor')}</h4>
            <div className={styles.filterRow}>
              <label className={styles.label}>
                {t('projects.selectTeam')}
                <select
                  value={filterTeamId}
                  onChange={(e) => setFilterTeamId(e.target.value)}
                  className={styles.input}
                >
                  <option value="">-- {t('projects.activityFilterAll')} --</option>
                  {teamIdsInProject.map((id) => (
                    <option key={id} value={id}>{getTeamCode(id)}</option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                {t('projects.selectWorkItem')}
                <select
                  value={filterWorkItemId}
                  onChange={(e) => setFilterWorkItemId(e.target.value)}
                  className={styles.input}
                >
                  <option value="">-- {t('projects.activityFilterAll')} --</option>
                  {workItemIdsInProject.map((id) => (
                    <option key={id} value={id}>{getWorkItemCode(id)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.filterRow}>
              <label className={styles.label}>
                {t('projects.activityStartDate')}
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.label}>
                {t('projects.activityEndDate')}
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className={styles.input}
                />
              </label>
            </div>
            <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('jobs.date')}</th>
                  <th>{t('jobs.team')}</th>
                  <th>{t('jobs.workItem')}</th>
                  <th>{t('jobs.quantity')}</th>
                  <th aria-label={t('jobs.jobCode')}></th>
                  <th>{t('jobs.createdAt')}</th>
                  <th>{t('jobs.approvedAt')}</th>
                  <th>{t('jobs.status')}</th>
                </tr>
              </thead>
              <tbody>
                {projectJobsFiltered.length === 0 && (
                  <tr><td colSpan={8} className={styles.muted}>{t('common.noData')}</td></tr>
                )}
                {projectJobsFiltered.map((job) => (
                  <tr key={job.id}>
                    <td>{new Date(job.date).toLocaleDateString()}</td>
                    <td>{getTeamCode(job.teamId)}</td>
                    <td>{getWorkItemLabel(job.workItemId)}</td>
                    <td>{job.quantity}</td>
                    <td>
                      <button type="button" className={styles.jobCodeBtn} onClick={() => setModalJobId(job.id)} title={t('jobs.jobCodeModalTitle')}>
                        #{job.id.slice(0, 8)}
                      </button>
                    </td>
                    <td>{job.createdAt ? new Date(job.createdAt).toLocaleString() : '–'}</td>
                    <td>{job.approvedAt ? new Date(job.approvedAt).toLocaleString() : '–'}</td>
                    <td>
                      <div>{t(`jobs.${job.status}`)}</div>
                      {job.status === 'approved' && job.approvedBy && (
                        <div className={styles.muted} style={{ fontSize: '0.8rem' }}>
                          {t('jobs.approvedBy')}: {getUserName(job.approvedBy)}
                        </div>
                      )}
                      {job.status === 'rejected' && job.rejectedBy && (
                        <div className={styles.muted} style={{ fontSize: '0.8rem' }}>
                          {t('jobs.rejectedBy')}: {getUserName(job.rejectedBy)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {modalJobId && (() => {
              const allJobs = store.getJobs(companyId);
              const modalJob = allJobs.find((j) => j.id === modalJobId);
              const photos = modalJob?.notePhotos?.length ? modalJob.notePhotos : (modalJob?.notePhoto ? [modalJob.notePhoto] : []);
              return (
                <div className={styles.modalOverlay} onClick={() => setModalJobId(null)} role="dialog" aria-modal="true" aria-labelledby="project-job-detail-modal-title">
                  <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                      <h2 id="project-job-detail-modal-title" className={styles.modalTitle}>
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
                      {photos.length > 0 ? (
                        <div className={styles.modalPhotoSection}>
                          <strong>{t('jobs.photo')}</strong>
                          <div className={styles.modalPhotoList}>
                            {photos.map((src, i) => (
                              <img key={i} src={src} alt="" className={styles.modalPhotoImg} />
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {!modalJob?.notes && photos.length === 0 && (
                        <p className={styles.modalPlaceholder}>{t('jobs.jobDetailModalPlaceholder')}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            <h4 className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>{t('projects.projectMaterialsUsed')}</h4>

            <h4 className={styles.sectionTitle} style={{ marginTop: '0.75rem', fontSize: '1rem' }}>
              {t('projects.projectMaterialsUsedByJob')}
            </h4>
            <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('jobs.date')}</th>
                  <th>{t('jobs.team')}</th>
                  <th>{t('jobs.workItem')}</th>
                  <th>{t('deliveryNotes.material')}</th>
                  <th>{t('deliveryNotes.unit')}</th>
                  <th>{t('deliveryNotes.quantity')}</th>
                  <th>{t('jobs.approvedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {projectMaterialRowsByJob.length === 0 && (
                  <tr><td colSpan={7} className={styles.muted}>{t('common.noData')}</td></tr>
                )}
                {projectMaterialRowsByJob.map((r) => (
                  <tr key={r.key}>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td>{getTeamCode(r.teamId)}</td>
                    <td>{getWorkItemLabel(r.workItemId)}</td>
                    <td>{r.materialLabel}</td>
                    <td>{r.unit === 'm' ? 'm' : t('jobs.material.pcs')}</td>
                    <td>{r.qty}</td>
                    <td>{r.approvedAt ? new Date(r.approvedAt).toLocaleString() : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <h4 className={styles.sectionTitle} style={{ marginTop: '0.75rem', fontSize: '1rem' }}>
              {t('projects.projectMaterialsUsedSummary')}
            </h4>
            <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('deliveryNotes.material')}</th>
                  <th>{t('deliveryNotes.unit')}</th>
                  <th>{t('deliveryNotes.quantity')}</th>
                </tr>
              </thead>
              <tbody>
                {projectMaterialSummary.length === 0 && (
                  <tr><td colSpan={3} className={styles.muted}>{t('common.noData')}</td></tr>
                )}
                {projectMaterialSummary.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td>{r.unit === 'm' ? 'm' : t('jobs.material.pcs')}</td>
                    <td>{r.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </Card>
    );
  }

  // Kampanya seçili değilse: sadece kampanya listesi
  if (!selectedCampaignId && !selectedProjectId) {
    return (
      <Card>
        <div className={styles.toolbar}>
          <h3 className={styles.sectionTitle}>{t('campaigns.title')}</h3>
        </div>
        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('campaigns.campaignName')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={2} className={styles.muted}>{t('common.noData')}</td>
              </tr>
            )}
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <button
                    type="button"
                    className={styles.smallBtnEdit}
                    onClick={() => {
                      setSelectedCampaignId(c.id);
                      setListFilter('ACTIVE');
                    }}
                  >
                    {t('projects.viewDetail')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    );
  }

  // Kampanya seçili, proje listesi görünümü
  return (
    <Card>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => {
            setSelectedCampaignId(null);
            setShowForm(false);
            setEditing(null);
            setError('');
          }}
        >
          {t('projects.backToList')}
        </button>
        <h3 className={styles.sectionTitle}>
          {selectedCampaignId ? getCampaignName(selectedCampaignId) : t('campaigns.title')}
        </h3>
        {!editing && (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              setShowForm(!showForm);
              setError('');
              setForm({
                ...defaultForm,
                receivedDate: new Date().toISOString().slice(0, 10),
                campaignId: selectedCampaignId ?? '',
              });
            }}
          >
            {showForm ? t('common.cancel') : t('projects.createProject')}
          </button>
        )}
      </div>
      <div className={styles.chipGroup}>
        {LIST_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            className={listFilter === status ? styles.chipActive : styles.chip}
            onClick={() => setListFilter(status)}
          >
            {status === 'ACTIVE' && t('projects.activeProjects')}
            {status === 'COMPLETED' && t('projects.completedProjects')}
            {status === 'ARCHIVED' && t('projects.archivedProjects')}
          </button>
        ))}
      </div>
      {error && <p className={styles.saveError}>{t(error)}</p>}
      {(showForm || editing) && (
        <form onSubmit={handleSave} className={styles.form}>
          <label className={styles.label}>
            {t('campaigns.campaign')}
            <div className={styles.inputRow}>
              <select
                value={form.campaignId}
                onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))}
                className={styles.input}
                required
              >
                <option value="">-- {t('campaigns.selectCampaign')} --</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!showNewCampaign ? (
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowNewCampaign(true)}>
                  {t('campaigns.createCampaign')}
                </button>
              ) : (
                <div className={styles.inputRow}>
                  <input
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className={styles.input}
                    placeholder={t('campaigns.campaignName')}
                  />
                  <button type="button" className={styles.primaryBtn} onClick={handleAddCampaign}>
                    {t('common.add')}
                  </button>
                  <button type="button" className={styles.secondaryBtn} onClick={() => { setShowNewCampaign(false); setNewCampaignName(''); }}>
                    {t('common.cancel')}
                  </button>
                </div>
              )}
            </div>
            {campaigns.length === 0 && !showNewCampaign && <p className={styles.hint}>{t('campaigns.noCampaigns')}</p>}
          </label>
          <label className={styles.label}>
            {t('projects.projectYear')}
            <input
              type="number"
              min={PROJECT_YEAR_MIN}
              max={PROJECT_YEAR_MAX}
              value={form.projectYear}
              onChange={(e) => setForm((f) => ({ ...f, projectYear: e.target.value }))}
              className={styles.input}
              placeholder={t('projects.projectYearPlaceholder')}
              required
            />
          </label>
          <label className={styles.label}>
            {t('projects.externalProjectId')}
            <input
              value={form.externalProjectId}
              onChange={(e) => setForm((f) => ({ ...f, externalProjectId: e.target.value }))}
              className={styles.input}
              placeholder={t('projects.externalProjectIdPlaceholder')}
              required
            />
          </label>
          <label className={styles.label}>
            {t('projects.receivedDate')}
            <input
              type="date"
              value={form.receivedDate}
              onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))}
              className={styles.input}
              required
            />
          </label>
          {projectKeyPreview && (
            <p className={styles.projectKeyPreview}>
              <strong>{t('projects.projectKey')}:</strong> {projectKeyPreview}
            </p>
          )}
          <label className={styles.label}>
            {t('projects.name')}
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={styles.input}
              placeholder={t('projects.namePlaceholder')}
            />
          </label>
          <label className={styles.label}>
            {t('projects.description')}
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={styles.input}
              rows={2}
              placeholder={t('projects.descriptionPlaceholder')}
            />
          </label>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>{t('common.save')}</button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setShowForm(false);
                setEditing(null);
                setForm(defaultForm);
                setError('');
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
      <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('projects.projectKey')}</th>
            <th>{t('projects.receivedDate')}</th>
            <th>{t('projects.status')}</th>
            {listFilter === 'COMPLETED' && <th>{t('projects.completedAt')}</th>}
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {projectsInSelectedCampaign.length === 0 && !showForm && (
            <tr>
              <td colSpan={listFilter === 'COMPLETED' ? 5 : 4} className={styles.noData}>
                {t('common.noData')}
              </td>
            </tr>
          )}
          {projectsInSelectedCampaign.map((p) => (
            <tr key={p.id}>
              <td>
                <button type="button" className={styles.linkBtn} onClick={() => setSelectedProjectId(p.id)}>
                  {getProjectDisplayKey(p)}
                </button>
              </td>
              <td>{p.receivedDate ? new Date(p.receivedDate).toLocaleDateString() : '–'}</td>
              <td>{t(`projects.status_${p.status}`)}</td>
              {listFilter === 'COMPLETED' && (
                <td>{p.completedAt ? new Date(p.completedAt).toLocaleDateString() : '–'}</td>
              )}
              <td>
                <button type="button" className={styles.linkBtn} onClick={() => setSelectedProjectId(p.id)}>
                  {t('projects.viewDetail')}
                </button>
                <button
                  type="button"
                  className={styles.smallBtnEdit}
                  onClick={() => {
                    setEditing(p);
                    setForm({
                      campaignId: p.campaignId,
                      projectYear: String(p.projectYear),
                      externalProjectId: p.externalProjectId,
                      receivedDate: p.receivedDate ?? new Date().toISOString().slice(0, 10),
                      name: p.name ?? '',
                      description: p.description ?? '',
                    });
                    setError('');
                  }}
                >
                  {t('common.edit')}
                </button>
                {p.status === 'ACTIVE' && (
                  <button type="button" className={styles.smallBtnDanger} onClick={() => handleArchive(p)}>
                    {t('projects.archive')}
                  </button>
                )}
                {(p.status === 'COMPLETED' || p.status === 'ARCHIVED') && (
                  <button type="button" className={styles.secondaryBtn} style={{ marginLeft: 8 }} onClick={() => handleActivate(p)}>
                    {t('projects.activate')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
  );
}
