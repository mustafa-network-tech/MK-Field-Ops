import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { canPlanAccessFeature } from '../services/planGating';
import { getEffectivePlan } from '../services/subscriptionService';
import { store } from '../data/store';
import { getTeamsForJobEntry } from '../services/teamScopeService';
import { addJob } from '../services/jobService';
import { formatPriceForUser } from '../utils/priceRules';
import { parseDecimalFromLocale, roundMoney } from '../utils/formatLocale';
import { getProjectDisplayKey } from '../utils/projectKey';
import { Card } from '../components/ui/Card';
import type { JobMaterialUsage, MaterialMainType } from '../types';
import styles from './JobEntry.module.css';

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

function isMeterType(mainType: string): boolean {
  return mainType === 'boru' || mainType === 'kablo_ic' || mainType === 'kablo_yeraltı' || mainType === 'kablo_havai';
}

export function JobEntry() {
  const { t, locale } = useI18n();
  const { user, company } = useApp();
  const companyId = user?.companyId ?? '';
  const planAllowsProjects = canPlanAccessFeature(getEffectivePlan(company), 'projects');
  const effectivePlan = getEffectivePlan(company);
  const defaultStarterProjectId = useMemo(
    () => (effectivePlan === 'starter' ? store.ensureStarterDefaultProject(companyId, effectivePlan) : null),
    [companyId, effectivePlan]
  );
  const teams = getTeamsForJobEntry(companyId, user);
  const workItems = store.getWorkItems(companyId);
  const equipment = store.getEquipment(companyId);
  const stockItems = store.getMaterialStock(companyId);
  const campaigns = planAllowsProjects ? store.getCampaigns(companyId) : [];
  const activeProjects = planAllowsProjects ? store.getProjects(companyId, { status: 'ACTIVE' }) : [];
  const starterProjectId = defaultStarterProjectId ?? (activeProjects.length > 0 ? activeProjects[0].id : '');

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [campaignId, setCampaignId] = useState('');
  const [projectId, setProjectId] = useState('');
  useEffect(() => {
    if (effectivePlan === 'starter' && starterProjectId && !projectId) {
      setProjectId(starterProjectId);
    }
  }, [effectivePlan, starterProjectId, projectId]);
  const [teamId, setTeamId] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  const projectsInCampaign = campaignId
    ? activeProjects.filter((p) => p.campaignId === campaignId)
    : [];
  const teamZimmet = teamId ? store.getTeamMaterialAllocations(companyId, teamId) : [];
  const [quantity, setQuantity] = useState(1);
  const [materialUsages, setMaterialUsages] = useState<JobMaterialUsage[]>([]);
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Add material form state
  const [addMaterialId, setAddMaterialId] = useState('');
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addIsExternal, setAddIsExternal] = useState(false);
  const [addExternalDesc, setAddExternalDesc] = useState('');
  const [addExternalUnit, setAddExternalUnit] = useState<'m' | 'pcs'>('pcs');
  const [addMaterialError, setAddMaterialError] = useState('');

  const selectedZimmet = addMaterialId ? teamZimmet.find((a) => a.id === addMaterialId) : null;
  const selectedStockItem = selectedZimmet
    ? stockItems.find((m) => m.id === selectedZimmet.materialStockItemId)
    : null;
  const availableQty = selectedZimmet && selectedStockItem
    ? isMeterType(selectedStockItem.mainType)
      ? selectedZimmet.quantityMeters ?? 0
      : selectedZimmet.quantityPcs ?? 0
    : 0;
  const isCable = selectedStockItem ? isMeterType(selectedStockItem.mainType) : false;
  const quantityUnit = isCable ? 'm' : 'pcs';

  const handleAddMaterial = () => {
    setAddMaterialError('');
    if (addIsExternal) {
      if (!addExternalDesc.trim()) {
        setAddMaterialError('jobs.material.externalDescriptionRequired');
        return;
      }
      setMaterialUsages((prev) => [
        ...prev,
        {
          materialStockItemId: null,
          isExternal: true,
          externalDescription: addExternalDesc.trim(),
          quantity: addQuantity,
          quantityUnit: addExternalUnit,
        },
      ]);
      setAddQuantity(1);
      setAddIsExternal(false);
      setAddExternalDesc('');
      setAddMaterialId('');
      return;
    }
    if (!addMaterialId || !selectedZimmet || !selectedStockItem) {
      setAddMaterialError('validation.required');
      return;
    }
    if (addQuantity <= 0) {
      setAddMaterialError('validation.positiveNumber');
      return;
    }
    if (addQuantity > availableQty) {
      setAddMaterialError('jobs.insufficientZimmet');
      return;
    }
    setMaterialUsages((prev) => [
      ...prev,
      {
        teamZimmetId: selectedZimmet.id,
        materialStockItemId: selectedZimmet.materialStockItemId,
        isExternal: false,
        quantity: addQuantity,
        quantityUnit: quantityUnit as 'm' | 'pcs',
      },
    ]);
    setAddMaterialId('');
    setAddQuantity(1);
    setAddIsExternal(false);
    setAddExternalDesc('');
  };

  const removeMaterialUsage = (index: number) => {
    setMaterialUsages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!teamId || !workItemId || !user) return;
    if (quantity < 0.01) {
      setSubmitError('validation.positiveNumber');
      return;
    }
    const effectiveProjectId = planAllowsProjects ? projectId : starterProjectId;
    if (!effectiveProjectId) {
      setSubmitError('projects.projectNotFound');
      return;
    }
    for (const u of materialUsages) {
      if (u.isExternal && !(u.externalDescription?.trim())) {
        setSubmitError('jobs.material.externalDescriptionRequired');
        return;
      }
    }
    const result = addJob(user, {
      companyId,
      date,
      projectId: effectiveProjectId,
      teamId,
      workItemId,
      quantity,
      materialIds: [],
      materialUsages,
      equipmentIds,
      notes,
      createdBy: user.id,
    });
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setQuantity(1);
    if (planAllowsProjects) {
      setCampaignId('');
      setProjectId('');
    }
    setMaterialUsages([]);
    setEquipmentIds([]);
    setNotes('');
  };

  const toggleEquipment = (id: string) => {
    setEquipmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const getMaterialLabel = (u: JobMaterialUsage): string => {
    if (u.isExternal) return u.externalDescription ?? t('jobs.material.external');
    let stockId: string | null = u.materialStockItemId ?? null;
    if (!stockId && u.teamZimmetId) {
      const alloc = store.getTeamMaterialAllocations(companyId).find((a) => a.id === u.teamZimmetId);
      stockId = alloc?.materialStockItemId ?? null;
    }
    const item = stockId ? stockItems.find((m) => m.id === stockId) : null;
    if (!item) return '–';
    const typeLabel = t(TYPE_DISPLAY_KEYS[item.mainType]);
    const namePart = item.spoolId ? `${item.name ?? item.capacityLabel} (${item.spoolId})` : (item.name ?? item.capacityLabel ?? item.id);
    return `${typeLabel} — ${namePart}`;
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
            {planAllowsProjects && (
              <label className={styles.label}>
                {t('campaigns.campaign')}
                <select
                  value={campaignId}
                  onChange={(e) => { setCampaignId(e.target.value); setProjectId(''); }}
                  className={styles.input}
                  required
                >
                  <option value="">-- {t('campaigns.selectCampaign')} --</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {campaigns.length === 0 && <p className={styles.hint}>{t('campaigns.noCampaigns')}</p>}
              </label>
            )}
          </div>
          <div className={styles.row}>
            {planAllowsProjects && (
              <label className={styles.label}>
                {t('projects.projectKey')}
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={styles.input}
                  required
                  disabled={!campaignId}
                >
                  <option value="">-- {t('projects.selectProject')} --</option>
                  {projectsInCampaign.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {getProjectDisplayKey(proj)}{proj.name ? ` — ${proj.name}` : ''}
                    </option>
                  ))}
                </select>
                {campaignId && projectsInCampaign.length === 0 && <p className={styles.hint}>{t('projects.projectNotFound')}</p>}
              </label>
            )}
            <label className={styles.label}>
              {t('jobs.team')}
              <select value={teamId} onChange={(e) => { setTeamId(e.target.value); setAddMaterialId(''); }} className={styles.input} required>
                <option value="">-- {t('common.search')} --</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.code}</option>
                ))}
              </select>
              {teams.length === 0 && <p className={styles.hint}>{t('jobs.noTeamsAvailable')}</p>}
            </label>
          </div>
          {submitError && <p className={styles.error}>{t(submitError)}</p>}
          <div className={styles.row}>
            <label className={styles.label}>
              {t('jobs.workItem')}
              <select value={workItemId} onChange={(e) => setWorkItemId(e.target.value)} className={styles.input} required>
                <option value="">-- {t('common.search')} --</option>
                {workItems.map((wi) => (
                  <option key={wi.id} value={wi.id}>{wi.code} – {formatPriceForUser(wi.unitPrice, user, 'companyOrTotal', locale)}</option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              {t('jobs.quantity')}
              <input
                type="text"
                inputMode="decimal"
                min={0.01}
                value={quantity}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') {
                    setQuantity(0);
                    return;
                  }
                  const r = parseDecimalFromLocale(raw, locale);
                  if (r.ok && r.value >= 0) setQuantity(roundMoney(r.value));
                }}
                className={styles.input}
                required
              />
            </label>
          </div>

          <label className={styles.label}>{t('jobs.usedMaterials')} <span className={styles.muted}>({t('jobs.material.optional')})</span></label>
          <div className={styles.materialAddSection}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={addIsExternal}
                onChange={(e) => {
                  setAddIsExternal(e.target.checked);
                  setAddMaterialId('');
                  setAddMaterialError('');
                }}
              />
              <span>{t('jobs.material.useExternal')}</span>
            </label>
            {!addIsExternal && (
              <>
                {!teamId ? (
                  <p className={styles.hint}>{t('jobs.selectTeamToViewZimmet')}</p>
                ) : (
                  <>
                    <select
                      value={addMaterialId}
                      onChange={(e) => {
                        setAddMaterialId(e.target.value);
                        setAddMaterialError('');
                        const alloc = teamZimmet.find((a) => a.id === e.target.value);
                        if (alloc) {
                          const it = stockItems.find((m) => m.id === alloc.materialStockItemId);
                          setAddQuantity(it && isMeterType(it.mainType) ? 1 : 1);
                        }
                      }}
                      className={styles.input}
                      disabled={!teamId}
                    >
                      <option value="">-- {t('jobs.material.selectMaterial')} --</option>
                      {teamZimmet.map((alloc) => {
                        const m = stockItems.find((s) => s.id === alloc.materialStockItemId);
                        if (!m) return null;
                        const isC = isMeterType(m.mainType);
                        const remaining = isC ? (alloc.quantityMeters ?? 0) : (alloc.quantityPcs ?? 0);
                        const typeLabel = t(TYPE_DISPLAY_KEYS[m.mainType]);
                        const namePart = m.spoolId ? `${m.name ?? m.capacityLabel} (${m.spoolId})` : (m.name ?? m.capacityLabel ?? m.id);
                        const remLabel = isC ? `${remaining} m` : String(remaining);
                        const label = `${typeLabel} — ${namePart} — ${t('jobs.zimmetRemaining')}: ${remLabel}`;
                        return <option key={alloc.id} value={alloc.id}>{label}</option>;
                      })}
                    </select>
                    {selectedZimmet && selectedStockItem && (
                      <span className={styles.helper}>
                        {t('jobs.zimmetRemaining')}: {availableQty} {quantityUnit === 'm' ? 'm' : t('jobs.material.pcs')}
                      </span>
                    )}
                  </>
                )}
              </>
            )}
            <div className={styles.row}>
              <label className={styles.label}>
                {addIsExternal
                  ? (addExternalUnit === 'm' ? t('materials.quantityMeters') : t('materials.quantityPcs'))
                  : (quantityUnit === 'm' ? t('materials.quantityMeters') : t('materials.quantityPcs'))}
                <input
                  type="number"
                  min={1}
                  step={1}
                  max={addIsExternal ? undefined : (availableQty >= 1 ? availableQty : undefined)}
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(Math.floor(Number(e.target.value) || 0) || 1)}
                  className={styles.input}
                  style={{ maxWidth: 120 }}
                />
              </label>
              {addIsExternal && (
                <>
                  <label className={styles.label}>
                    {t('jobs.material.unit')}
                    <select
                      value={addExternalUnit}
                      onChange={(e) => setAddExternalUnit(e.target.value as 'm' | 'pcs')}
                      className={styles.input}
                      style={{ maxWidth: 100 }}
                    >
                      <option value="m">m</option>
                      <option value="pcs">{t('jobs.material.pcs')}</option>
                    </select>
                  </label>
                  <label className={styles.label} style={{ flex: 1 }}>
                    {t('jobs.material.externalDescriptionLabel')}
                    <input
                      type="text"
                      value={addExternalDesc}
                      onChange={(e) => setAddExternalDesc(e.target.value)}
                      className={styles.input}
                      placeholder={t('jobs.material.externalDescriptionPlaceholder')}
                    />
                  </label>
                </>
              )}
            </div>
            {addMaterialError && <p className={styles.error}>{t(addMaterialError)}</p>}
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleAddMaterial}
              disabled={!addIsExternal && !teamId}
              title={!addIsExternal && !teamId ? t('jobs.selectTeamToViewZimmet') : undefined}
            >
              {t('jobs.material.addMaterial')}
            </button>
          </div>
          {materialUsages.length > 0 && (
            <ul className={styles.usageList}>
              {materialUsages.map((u, i) => (
                <li key={i} className={styles.usageItem}>
                  <span>
                    {getMaterialLabel(u)} – {u.quantity} {u.quantityUnit === 'm' ? 'm' : t('jobs.material.pcs')}
                    {u.isExternal ? ` (${t('jobs.material.external')} – ${u.externalDescription})` : ` (${t('jobs.material.fromZimmet')})`}
                  </span>
                  <button type="button" className={styles.removeBtn} onClick={() => removeMaterialUsage(i)} aria-label={t('common.delete')}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

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
