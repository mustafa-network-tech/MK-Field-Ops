import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { getProjectDisplayKey } from '../../utils/projectKey';
import { Card } from '../ui/Card';
import type { Project, ProjectStatus } from '../../types';
import styles from './ManagementTabs.module.css';

const PROJECT_YEAR_MIN = 2000;
const PROJECT_YEAR_MAX = 2100;
const LIST_FILTERS: ProjectStatus[] = ['ACTIVE', 'COMPLETED', 'ARCHIVED'];

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
  const projects = listFilter ? allProjects.filter((p) => p.status === listFilter) : allProjects;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [error, setError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [completeError, setCompleteError] = useState('');
  type ActivityFilterMode = 'all' | 'byTeam' | 'byWorkItem';
  const [activityFilterMode, setActivityFilterMode] = useState<ActivityFilterMode>('all');
  const [activityTeamId, setActivityTeamId] = useState('');
  const [activityWorkItemId, setActivityWorkItemId] = useState('');

  useEffect(() => {
    if (selectedProjectId) {
      setActivityFilterMode('all');
      setActivityTeamId('');
      setActivityWorkItemId('');
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
        store.updateProject(editing.id, {
          campaignId: form.campaignId,
          projectYear: yearNum,
          externalProjectId: external,
          receivedDate,
          name: form.name.trim() || undefined,
          description: form.description.trim() || undefined,
        });
        setEditing(null);
      } else {
        store.addProject({
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
    setForm((f) => ({ ...f, campaignId: c.id }));
    setNewCampaignName('');
    setShowNewCampaign(false);
  };

  const handleArchive = (p: Project) => {
    setError('');
    try {
      store.updateProject(p.id, { status: 'ARCHIVED' });
    } catch {
      setError('messages.error');
    }
  };

  const handleActivate = (p: Project) => {
    setError('');
    try {
      store.updateProject(p.id, { status: 'ACTIVE' });
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
    store.completeProject(selectedProjectId, user.id);
    setConfirmCompleteOpen(false);
    setSelectedProjectId(null);
  };

  const getCampaignName = (campaignId: string): string => {
    const c = store.getCampaign(campaignId);
    return c?.name ?? campaignId;
  };

  const selectedProject = selectedProjectId ? store.getProject(selectedProjectId) : null;
  const projectJobsAll = selectedProjectId
    ? store.getJobs(companyId).filter((j) => j.projectId === selectedProjectId)
    : [];
  const hasPendingApprovals = projectJobsAll.some((j) => j.status === 'submitted');
  const projectJobsApproved = projectJobsAll
    .filter((j) => j.status === 'approved')
    .sort((a, b) => (b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
  const teams = store.getTeams(companyId);
  const workItems = store.getWorkItems(companyId);
  const getTeamCode = (id: string) => teams.find((t) => t.id === id)?.code ?? id;
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;

  const teamIdsInProject = Array.from(new Set(projectJobsApproved.map((j) => j.teamId)));
  const workItemIdsInProject = Array.from(new Set(projectJobsApproved.map((j) => j.workItemId)));

  const projectJobsFiltered =
    activityFilterMode === 'all'
      ? projectJobsApproved
      : activityFilterMode === 'byTeam' && activityTeamId
        ? projectJobsApproved.filter((j) => j.teamId === activityTeamId)
        : activityFilterMode === 'byWorkItem' && activityWorkItemId
          ? projectJobsApproved.filter((j) => j.workItemId === activityWorkItemId)
          : projectJobsApproved;

  if (selectedProject && selectedProjectId) {
    return (
      <Card>
        <div className={styles.toolbar}>
          <button type="button" className={styles.secondaryBtn} onClick={() => { setSelectedProjectId(null); setCompleteError(''); }}>
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
            <div className={styles.segmentGroup}>
              <button
                type="button"
                className={activityFilterMode === 'all' ? styles.segmentActive : styles.segment}
                onClick={() => { setActivityFilterMode('all'); setActivityTeamId(''); setActivityWorkItemId(''); }}
              >
                {t('projects.activityFilterAll')}
              </button>
              <button
                type="button"
                className={activityFilterMode === 'byTeam' ? styles.segmentActive : styles.segment}
                onClick={() => { setActivityFilterMode('byTeam'); setActivityWorkItemId(''); }}
              >
                {t('projects.activityFilterByTeam')}
              </button>
              <button
                type="button"
                className={activityFilterMode === 'byWorkItem' ? styles.segmentActive : styles.segment}
                onClick={() => { setActivityFilterMode('byWorkItem'); setActivityTeamId(''); }}
              >
                {t('projects.activityFilterByWorkItem')}
              </button>
            </div>
            {activityFilterMode === 'byTeam' && (
              <div className={styles.filterRow}>
                <label className={styles.label}>
                  {t('projects.selectTeam')}
                  <select
                    value={activityTeamId}
                    onChange={(e) => setActivityTeamId(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">-- {t('projects.selectTeam')} --</option>
                    {teamIdsInProject.map((id) => (
                      <option key={id} value={id}>{getTeamCode(id)}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {activityFilterMode === 'byWorkItem' && (
              <div className={styles.filterRow}>
                <label className={styles.label}>
                  {t('projects.selectWorkItem')}
                  <select
                    value={activityWorkItemId}
                    onChange={(e) => setActivityWorkItemId(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">-- {t('projects.selectWorkItem')} --</option>
                    {workItemIdsInProject.map((id) => (
                      <option key={id} value={id}>{getWorkItemCode(id)}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('jobs.date')}</th>
                  <th>{t('jobs.team')}</th>
                  <th>{t('jobs.workItem')}</th>
                  <th>{t('jobs.quantity')}</th>
                  <th>{t('jobs.createdAt')}</th>
                  <th>{t('jobs.approvedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {projectJobsFiltered.length === 0 && (
                  <tr><td colSpan={6} className={styles.muted}>{t('common.noData')}</td></tr>
                )}
                {projectJobsFiltered.map((job) => (
                  <tr key={job.id}>
                    <td>{new Date(job.date).toLocaleDateString()}</td>
                    <td>{getTeamCode(job.teamId)}</td>
                    <td>{getWorkItemCode(job.workItemId)}</td>
                    <td>{job.quantity}</td>
                    <td>{job.createdAt ? new Date(job.createdAt).toLocaleString() : '–'}</td>
                    <td>{job.approvedAt ? new Date(job.approvedAt).toLocaleString() : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('projects.title')}</h3>
        {!editing && (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              setShowForm(!showForm);
              setError('');
              setForm({ ...defaultForm, receivedDate: new Date().toISOString().slice(0, 10) });
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
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('projects.projectKey')}</th>
            <th>{t('campaigns.campaign')}</th>
            <th>{t('projects.receivedDate')}</th>
            <th>{t('projects.status')}</th>
            {listFilter === 'COMPLETED' && <th>{t('projects.completedAt')}</th>}
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>
                <button type="button" className={styles.linkBtn} onClick={() => setSelectedProjectId(p.id)}>
                  {getProjectDisplayKey(p)}
                </button>
              </td>
              <td>{getCampaignName(p.campaignId)}</td>
              <td>{p.receivedDate ? new Date(p.receivedDate).toLocaleDateString() : '–'}</td>
              <td>{t(`projects.status_${p.status}`)}</td>
              {listFilter === 'COMPLETED' && <td>{p.completedAt ? new Date(p.completedAt).toLocaleDateString() : '–'}</td>}
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
      {projects.length === 0 && !showForm && <p className={styles.noData}>{t('common.noData')}</p>}
    </Card>
  );
}
