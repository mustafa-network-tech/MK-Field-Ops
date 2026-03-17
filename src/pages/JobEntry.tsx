import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { canPlanAccessFeature } from '../services/planGating';
import { getEffectivePlan } from '../services/subscriptionService';
import { store } from '../data/store';
import { getTeamsForJobEntry } from '../services/teamScopeService';
import { addJob } from '../services/jobService';
import { parseDecimalFromLocale, roundMoney } from '../utils/formatLocale';
import { formatUnitPriceForUser } from '../utils/priceRules';
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

export interface JobRowState {
  id: string;
  date: string;
  campaignId: string;
  projectId: string;
  teamId: string;
  workItemId: string;
  workItemSearch: string;
  quantity: number;
  materialUsages: JobMaterialUsage[];
  equipmentIds: string[];
  notes: string;
  addMaterialId: string;
  addQuantity: number;
  addIsExternal: boolean;
  addExternalDesc: string;
  addExternalUnit: 'm' | 'pcs';
}

function createDefaultRow(): JobRowState {
  return {
    id: crypto.randomUUID?.() ?? `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: new Date().toISOString().slice(0, 10),
    campaignId: '',
    projectId: '',
    teamId: '',
    workItemId: '',
    workItemSearch: '',
    quantity: 1,
    materialUsages: [],
    equipmentIds: [],
    notes: '',
    addMaterialId: '',
    addQuantity: 1,
    addIsExternal: false,
    addExternalDesc: '',
    addExternalUnit: 'pcs',
  };
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

  const [jobRows, setJobRows] = useState<JobRowState[]>(() => [createDefaultRow()]);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (effectivePlan !== 'starter' || !starterProjectId) return;
    setJobRows((prev) =>
      prev.map((row) => (row.projectId ? row : { ...row, projectId: starterProjectId }))
    );
  }, [effectivePlan, starterProjectId]);

  const updateRow = (index: number, patch: Partial<JobRowState>) => {
    setJobRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const addRow = () => {
    setJobRows((prev) => [...prev, createDefaultRow()]);
  };

  const removeRow = (index: number) => {
    setJobRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
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

  const [addMaterialError, setAddMaterialError] = useState('');

  const handleAddMaterialRow = (index: number) => {
    const row = jobRows[index];
    if (!row) return;
    setAddMaterialError('');
    if (row.addIsExternal) {
      if (!row.addExternalDesc.trim()) {
        setAddMaterialError('jobs.material.externalDescriptionRequired');
        return;
      }
      updateRow(index, {
        materialUsages: [
          ...row.materialUsages,
          {
            materialStockItemId: null,
            isExternal: true,
            externalDescription: row.addExternalDesc.trim(),
            quantity: row.addQuantity,
            quantityUnit: row.addExternalUnit,
          },
        ],
        addQuantity: 1,
        addIsExternal: false,
        addExternalDesc: '',
        addMaterialId: '',
      });
      return;
    }
    const teamZimmet = row.teamId ? store.getTeamMaterialAllocations(companyId, row.teamId) : [];
    const selectedZimmet = row.addMaterialId ? teamZimmet.find((a) => a.id === row.addMaterialId) : null;
    const selectedStockItem = selectedZimmet ? stockItems.find((m) => m.id === selectedZimmet.materialStockItemId) : null;
    if (!row.addMaterialId || !selectedZimmet || !selectedStockItem) {
      setAddMaterialError('validation.required');
      return;
    }
    if (row.addQuantity <= 0) {
      setAddMaterialError('validation.positiveNumber');
      return;
    }
    const isCableType = isMeterType(selectedStockItem.mainType);
    const availableQty = isCableType ? (selectedZimmet.quantityMeters ?? 0) : (selectedZimmet.quantityPcs ?? 0);
    if (row.addQuantity > availableQty) {
      setAddMaterialError('jobs.insufficientZimmet');
      return;
    }
    const quantityUnit = isCableType ? 'm' : 'pcs';
    updateRow(index, {
      materialUsages: [
        ...row.materialUsages,
        {
          teamZimmetId: selectedZimmet.id,
          materialStockItemId: selectedZimmet.materialStockItemId,
          isExternal: false,
          quantity: row.addQuantity,
          quantityUnit: quantityUnit as 'm' | 'pcs',
        },
      ],
      addMaterialId: '',
      addQuantity: 1,
      addIsExternal: false,
      addExternalDesc: '',
    });
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!user) return;
    for (let i = 0; i < jobRows.length; i++) {
      const row = jobRows[i];
      if (!row.teamId || !row.workItemId) {
        setSubmitError('validation.required');
        return;
      }
      if (row.quantity < 0.01) {
        setSubmitError('validation.positiveNumber');
        return;
      }
      const effectiveProjectId = planAllowsProjects ? row.projectId : starterProjectId;
      if (!effectiveProjectId) {
        setSubmitError('projects.projectNotFound');
        return;
      }
      for (const u of row.materialUsages) {
        if (u.isExternal && !(u.externalDescription?.trim())) {
          setSubmitError('jobs.material.externalDescriptionRequired');
          return;
        }
      }
      const result = addJob(user, {
        companyId,
        date: row.date,
        projectId: effectiveProjectId,
        teamId: row.teamId,
        workItemId: row.workItemId,
        quantity: row.quantity,
        materialIds: [],
        materialUsages: row.materialUsages,
        equipmentIds: row.equipmentIds,
        notes: row.notes,
        createdBy: user.id,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
    }
    setJobRows([createDefaultRow()]);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('jobs.title')}</h1>
      <Card title={t('jobs.addJob')}>
        <form onSubmit={handleSaveAll} className={styles.form}>
          {jobRows.map((row, index) => {
            const projectsInCampaign = row.campaignId
              ? activeProjects.filter((p) => p.campaignId === row.campaignId)
              : [];
            const teamZimmet = row.teamId ? store.getTeamMaterialAllocations(companyId, row.teamId) : [];
            const term = row.workItemSearch.trim().toLowerCase();
            const filteredWorkItems = !term
              ? workItems
              : workItems.filter((wi) => {
                  const name = (wi.description ?? '').toLowerCase();
                  const code = wi.code.toLowerCase();
                  return name.includes(term) || code.includes(term);
                });
            const selectedWorkItem = workItems.find((wi) => wi.id === row.workItemId) || null;
            const selectedWorkItemUnitLabel =
              selectedWorkItem?.unitType === 'm3'
                ? t('deliveryNotes.unitCubicMeter')
                : selectedWorkItem?.unitType === 'kg'
                ? t('deliveryNotes.unitKilo')
                : selectedWorkItem?.unitType === 'm'
                ? t('deliveryNotes.unitMeter')
                : selectedWorkItem?.unitType === 'pcs'
                ? t('deliveryNotes.unitPiece')
                : selectedWorkItem?.unitType ?? '';
            const selectedZimmet = row.addMaterialId ? teamZimmet.find((a) => a.id === row.addMaterialId) : null;
            const selectedStockItem = selectedZimmet ? stockItems.find((m) => m.id === selectedZimmet.materialStockItemId) : null;
            const isCable = selectedStockItem ? isMeterType(selectedStockItem.mainType) : false;
            const availableQty = selectedZimmet && selectedStockItem
              ? isCable ? (selectedZimmet.quantityMeters ?? 0) : (selectedZimmet.quantityPcs ?? 0)
              : 0;
            const quantityUnit = isCable ? 'm' : 'pcs';

            return (
              <div key={row.id} className={styles.jobRowCard}>
                <div className={styles.jobRowHeader}>
                  <span className={styles.jobRowTitle}>{t('jobs.jobNumber', { n: index + 1 })}</span>
                  {jobRows.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeRowBtn}
                      onClick={() => removeRow(index)}
                      aria-label={t('common.delete')}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className={styles.row}>
                  <label className={styles.label}>
                    {t('jobs.date')}
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(index, { date: e.target.value })}
                      className={styles.input}
                      required
                    />
                  </label>
                  {planAllowsProjects && (
                    <label className={styles.label}>
                      {t('campaigns.campaign')}
                      <select
                        value={row.campaignId}
                        onChange={(e) => updateRow(index, { campaignId: e.target.value, projectId: '' })}
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
                        value={row.projectId}
                        onChange={(e) => updateRow(index, { projectId: e.target.value })}
                        className={styles.input}
                        required
                        disabled={!row.campaignId}
                      >
                        <option value="">-- {t('projects.selectProject')} --</option>
                        {projectsInCampaign.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            {getProjectDisplayKey(proj)}{proj.name ? ` — ${proj.name}` : ''}
                          </option>
                        ))}
                      </select>
                      {row.campaignId && projectsInCampaign.length === 0 && <p className={styles.hint}>{t('projects.projectNotFound')}</p>}
                    </label>
                  )}
                  <label className={styles.label}>
                    {t('jobs.team')}
                    <select
                      value={row.teamId}
                      onChange={(e) => updateRow(index, { teamId: e.target.value, addMaterialId: '' })}
                      className={styles.input}
                      required
                    >
                      <option value="">-- {t('common.search')} --</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.code}</option>
                      ))}
                    </select>
                    {teams.length === 0 && <p className={styles.hint}>{t('jobs.noTeamsAvailable')}</p>}
                  </label>
                </div>
                <div className={styles.row}>
                  <label className={styles.label}>
                    {t('jobs.workItem')}
                    <input
                      type="text"
                      value={row.workItemSearch}
                      onChange={(e) => updateRow(index, { workItemSearch: e.target.value })}
                      className={styles.input}
                      placeholder={t('common.search')}
                      style={{ marginBottom: 4 }}
                    />
                    <select
                      value={row.workItemId}
                      onChange={(e) => updateRow(index, { workItemId: e.target.value })}
                      className={styles.input}
                      required
                    >
                      <option value="">-- {t('common.search')} --</option>
                      {filteredWorkItems.map((wi) => {
                        const label = wi.description ? `${wi.description} – ${wi.code}` : wi.code;
                        return <option key={wi.id} value={wi.id}>{label}</option>;
                      })}
                    </select>
                  </label>
                  <label className={styles.label}>
                    {t('jobs.quantity')}
                    {selectedWorkItemUnitLabel ? ` (${selectedWorkItemUnitLabel})` : ''}
                    <input
                      type="text"
                      inputMode="decimal"
                      min={0.01}
                      value={row.quantity}
                      placeholder={selectedWorkItemUnitLabel ? `10 ${selectedWorkItemUnitLabel}` : ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === '') {
                          updateRow(index, { quantity: 0 });
                          return;
                        }
                        const r = parseDecimalFromLocale(raw, locale);
                        if (r.ok && r.value >= 0) updateRow(index, { quantity: roundMoney(r.value) });
                      }}
                      className={styles.input}
                      required
                    />
                  </label>
                </div>
                {selectedWorkItem && row.teamId && (
                  <p className={styles.hint}>
                    {t('jobs.unitPrice')}{user?.role === 'teamLeader' ? ` (${t('jobs.yourTeamShare')})` : ''}: {formatUnitPriceForUser(selectedWorkItem.unitPrice, user, teams.find((t) => t.id === row.teamId)?.percentage, locale)}
                  </p>
                )}

                <label className={styles.label}>{t('jobs.usedMaterials')} <span className={styles.muted}>({t('jobs.material.optional')})</span></label>
                <div className={styles.materialAddSection}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={row.addIsExternal}
                      onChange={(e) => updateRow(index, { addIsExternal: e.target.checked, addMaterialId: '' })}
                    />
                    <span>{t('jobs.material.useExternal')}</span>
                  </label>
                  {!row.addIsExternal && (
                    <>
                      {!row.teamId ? (
                        <p className={styles.hint}>{t('jobs.selectTeamToViewZimmet')}</p>
                      ) : (
                        <>
                          <select
                            value={row.addMaterialId}
                            onChange={(e) => {
                              updateRow(index, { addMaterialId: e.target.value });
                              setAddMaterialError('');
                              const alloc = teamZimmet.find((a) => a.id === e.target.value);
                              if (alloc) {
                                const it = stockItems.find((m) => m.id === alloc.materialStockItemId);
                                updateRow(index, { addQuantity: it && isMeterType(it.mainType) ? 1 : 1 });
                              }
                            }}
                            className={styles.input}
                            disabled={!row.teamId}
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
                      {row.addIsExternal
                        ? (row.addExternalUnit === 'm' ? t('materials.quantityMeters') : t('materials.quantityPcs'))
                        : (quantityUnit === 'm' ? t('materials.quantityMeters') : t('materials.quantityPcs'))}
                      <input
                        type="number"
                        min={1}
                        step={1}
                        max={row.addIsExternal ? undefined : (availableQty >= 1 ? availableQty : undefined)}
                        value={row.addQuantity}
                        onChange={(e) => updateRow(index, { addQuantity: Math.floor(Number(e.target.value) || 0) || 1 })}
                        className={styles.input}
                        style={{ maxWidth: 120 }}
                      />
                    </label>
                    {row.addIsExternal && (
                      <>
                        <label className={styles.label}>
                          {t('jobs.material.unit')}
                          <select
                            value={row.addExternalUnit}
                            onChange={(e) => updateRow(index, { addExternalUnit: e.target.value as 'm' | 'pcs' })}
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
                            value={row.addExternalDesc}
                            onChange={(e) => updateRow(index, { addExternalDesc: e.target.value })}
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
                    onClick={() => handleAddMaterialRow(index)}
                    disabled={!row.addIsExternal && !row.teamId}
                    title={!row.addIsExternal && !row.teamId ? t('jobs.selectTeamToViewZimmet') : undefined}
                  >
                    {t('jobs.material.addMaterial')}
                  </button>
                </div>
                {row.materialUsages.length > 0 && (
                  <ul className={styles.usageList}>
                    {row.materialUsages.map((u, i) => (
                      <li key={i} className={styles.usageItem}>
                        <span>
                          {getMaterialLabel(u)} – {u.quantity} {u.quantityUnit === 'm' ? 'm' : t('jobs.material.pcs')}
                          {u.isExternal ? ` (${t('jobs.material.external')} – ${u.externalDescription})` : ` (${t('jobs.material.fromZimmet')})`}
                        </span>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => updateRow(index, { materialUsages: row.materialUsages.filter((_, j) => j !== i) })}
                          aria-label={t('common.delete')}
                        >
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
                        <input
                          type="checkbox"
                          checked={row.equipmentIds.includes(e.id)}
                          onChange={() => updateRow(index, {
                            equipmentIds: row.equipmentIds.includes(e.id)
                              ? row.equipmentIds.filter((x) => x !== e.id)
                              : [...row.equipmentIds, e.id],
                          })}
                        />
                        {e.code}
                      </label>
                    ))}
                    {equipment.length === 0 && <span className={styles.muted}>{t('common.noData')}</span>}
                  </div>
                </label>
                <label className={styles.label}>
                  {t('jobs.notes')}
                  <textarea
                    value={row.notes}
                    onChange={(e) => updateRow(index, { notes: e.target.value })}
                    className={styles.input}
                    rows={2}
                  />
                </label>
              </div>
            );
          })}

          {submitError && <p className={styles.error}>{t(submitError)}</p>}
          <div className={styles.formActions}>
            <button type="button" className={styles.addJobRowBtn} onClick={addRow}>
              + {t('jobs.addJobRow')}
            </button>
            <button type="submit" className={styles.primaryBtn}>
              {t('jobs.saveAllJobs')} ({t('jobs.draft')})
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
