import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getTeamsForJobEntry } from '../services/teamScopeService';
import { addJob } from '../services/jobService';
import { formatPriceForUser } from '../utils/priceRules';
import { Card } from '../components/ui/Card';
import styles from './JobEntry.module.css';

export function JobEntry() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const teams = getTeamsForJobEntry(companyId, user);
  const workItems = store.getWorkItems(companyId);
  const materials = store.getMaterials(companyId);
  const equipment = store.getEquipment(companyId);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [teamId, setTeamId] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!teamId || !workItemId || !user) return;
    const result = addJob(user, {
      companyId,
      date,
      teamId,
      workItemId,
      quantity,
      materialIds,
      equipmentIds,
      notes,
      createdBy: user.id,
    });
    if (!result.ok) {
      setSubmitError(t(result.error));
      return;
    }
    setQuantity(1);
    setMaterialIds([]);
    setEquipmentIds([]);
    setNotes('');
  };

  const toggleMaterial = (id: string) => {
    setMaterialIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleEquipment = (id: string) => {
    setEquipmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('jobs.title')}</h1>
      <Card title={t('jobs.addJob')}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.row}>
            <label className={styles.label}>
              {t('jobs.date')}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={styles.input} required />
            </label>
            <label className={styles.label}>
              {t('jobs.team')}
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={styles.input} required>
                <option value="">-- {t('common.search')} --</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.code}</option>
                ))}
              </select>
              {teams.length === 0 && <p className={styles.hint}>{t('jobs.noTeamsAvailable')}</p>}
            </label>
          </div>
          {submitError && <p className={styles.error}>{submitError}</p>}
          <div className={styles.row}>
            <label className={styles.label}>
              {t('jobs.workItem')}
              <select value={workItemId} onChange={(e) => setWorkItemId(e.target.value)} className={styles.input} required>
                <option value="">-- {t('common.search')} --</option>
                {workItems.map((wi) => (
                  <option key={wi.id} value={wi.id}>{wi.code} – {formatPriceForUser(wi.unitPrice, user, 'companyOrTotal')}</option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              {t('jobs.quantity')}
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} className={styles.input} required />
            </label>
          </div>
          <label className={styles.label}>
            {t('jobs.usedMaterials')}
            <div className={styles.chipGroup}>
              {materials.map((m) => (
                <label key={m.id} className={styles.chip}>
                  <input type="checkbox" checked={materialIds.includes(m.id)} onChange={() => toggleMaterial(m.id)} />
                  {m.code}
                </label>
              ))}
              {materials.length === 0 && <span className={styles.muted}>{t('common.noData')}</span>}
            </div>
          </label>
          <label className={styles.label}>
            {t('jobs.usedEquipment')}
            <div className={styles.chipGroup}>
              {equipment.map((e) => (
                <label key={e.id} className={styles.chip}>
                  <input type="checkbox" checked={equipmentIds.includes(e.id)} onChange={() => toggleEquipment(e.id)} />
                  {e.code}
                </label>
              ))}
              {equipment.length === 0 && <span className={styles.muted}>{t('common.noData')}</span>}
            </div>
          </label>
          <label className={styles.label}>
            {t('jobs.notes')}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={styles.input} rows={2} />
          </label>
          <button type="submit" className={styles.primaryBtn}>{t('common.save')} ({t('jobs.draft')})</button>
        </form>
      </Card>
    </div>
  );
}
