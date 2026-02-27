import React, { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { Card } from '../ui/Card';
import type { MaterialMainType, MaterialStockItem } from '../../types';
import styles from './ManagementTabs.module.css';

type FormState = {
  mainType: MaterialMainType;
  customGroupName: string;
  name: string;
  sizeOrCapacity: string;
  stockQty: number;
  capacityLabel: string;
  spoolId: string;
  lengthTotal: number;
};

const INITIAL_FORM: FormState = {
  mainType: 'direk',
  customGroupName: '',
  name: '',
  sizeOrCapacity: '',
  stockQty: 0,
  capacityLabel: '',
  spoolId: '',
  lengthTotal: 0,
};

export function MaterialsTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';

  const isCableType = (mainType: MaterialMainType) =>
    mainType === 'kablo_ic' || mainType === 'kablo_yeraltı' || mainType === 'kablo_havai';

  const allItems = store.getMaterialStock(companyId);
  const teams = store.getTeams(companyId);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editing, setEditing] = useState<MaterialStockItem | null>(null);
  const [error, setError] = useState('');
  const [distTeamId, setDistTeamId] = useState('');
  const [distMaterialId, setDistMaterialId] = useState('');
  const [distQuantity, setDistQuantity] = useState<number>(0);
  const [distError, setDistError] = useState('');
  const [distSuccess, setDistSuccess] = useState('');

  const itemsForSelectedType = useMemo(
    () => allItems.filter((m) => m.mainType === form.mainType),
    [allItems, form.mainType],
  );

  /** Dağıtım için: stokta kalanı olan malzemeler (kablo: lengthRemaining > 0, diğer: stockQty > 0) */
  const itemsWithStock = useMemo(
    () =>
      allItems.filter((m) =>
        isCableType(m.mainType)
          ? (m.lengthRemaining ?? 0) > 0
          : (m.stockQty ?? 0) > 0,
      ),
    [allItems],
  );
  const selectedDistItem = distMaterialId ? allItems.find((m) => m.id === distMaterialId) : null;
  const distMaxAvailable = selectedDistItem
    ? isCableType(selectedDistItem.mainType)
      ? selectedDistItem.lengthRemaining ?? 0
      : selectedDistItem.stockQty ?? 0
    : 0;

  const handleChange = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError('');
  };

  const handleStartNew = () => {
    setEditing(null);
    setForm(INITIAL_FORM);
    setError('');
  };

  const validateAndBuildPayload = ():
    | { ok: false; error: string }
    | { ok: true; payload: Omit<MaterialStockItem, 'id' | 'createdAt'> } => {
    if (!companyId) return { ok: false, error: 'validation.required' };

    const trimmedName = form.name.trim();
    const trimmedSize = form.sizeOrCapacity.trim();
    const trimmedSpoolId = form.spoolId.trim();
    const trimmedCapacity = form.capacityLabel.trim();
    const trimmedCustomGroup = form.customGroupName.trim();

    // Tür başına kayıt limitleri (kapasite / ebat için en fazla 15 çeşit)
    const countForType = allItems.filter((m) => m.mainType === form.mainType).length;
    const limits: Partial<Record<MaterialMainType, number>> = {
      direk: 15,
      kablo_ic: 15,
      kablo_yeraltı: 15,
      kablo_havai: 15,
      boru: 15,
      fiber_bina_kutusu: 15,
      ofsd: 15,
      sonlandirma_paneli: 15,
      daire_sonlandirma_kutusu: 15,
      menhol: 15,
      ek_odasi: 15,
      koruyucu_fider_borusu: 15,
      custom: 15,
    };
    const limit = limits[form.mainType];
    if (!editing && limit && countForType >= limit) {
      return { ok: false, error: 'materials.limitReached' };
    }

    // Özel türler
    if (form.mainType === 'custom') {
      if (!trimmedCustomGroup) return { ok: false, error: 'materials.customGroupRequired' };
      const distinctGroups = Array.from(
        new Set(
          allItems
            .filter((m) => m.mainType === 'custom')
            .map((m) => m.customGroupName ?? ''),
        ),
      ).filter(Boolean);
      if (!editing && !distinctGroups.includes(trimmedCustomGroup) && distinctGroups.length >= 10) {
        return { ok: false, error: 'materials.customGroupLimit' };
      }
      const itemsInGroup = allItems.filter(
        (m) => m.mainType === 'custom' && (m.customGroupName ?? '') === trimmedCustomGroup,
      );
      if (!editing && itemsInGroup.length >= 10) {
        return { ok: false, error: 'materials.customVariantLimit' };
      }
    }

    // Zorunlu alanlar – türe göre
    if (form.mainType === 'direk' || form.mainType === 'boru') {
      if (!trimmedName || !trimmedSize) return { ok: false, error: 'validation.required' };
    }

    if (
      ['fiber_bina_kutusu', 'ofsd', 'sonlandirma_paneli', 'daire_sonlandirma_kutusu', 'menhol', 'ek_odasi', 'koruyucu_fider_borusu'].includes(
        form.mainType,
      )
    ) {
      if (!trimmedName) return { ok: false, error: 'validation.required' };
    }

    if (form.mainType === 'custom') {
      if (!trimmedName) return { ok: false, error: 'validation.required' };
    }

    // Stok
    if (!isCableType(form.mainType) && form.stockQty < 0) {
      return { ok: false, error: 'validation.positiveNumber' };
    }

    // Kablo özel kontrolleri
    if (isCableType(form.mainType)) {
      if (!trimmedCapacity) return { ok: false, error: 'validation.required' };
      if (!trimmedSpoolId) return { ok: false, error: 'materials.spoolIdRequired' };
      if (form.lengthTotal <= 0) return { ok: false, error: 'validation.positiveNumber' };

      const existingWithSameId = allItems.find(
        (m) => m.companyId === companyId && m.spoolId === trimmedSpoolId && (!editing || m.id !== editing.id),
      );
      if (existingWithSameId) {
        return { ok: false, error: 'materials.spoolIdUnique' };
      }
    }

    const payload: Omit<MaterialStockItem, 'id' | 'createdAt'> = {
      companyId,
      mainType: form.mainType,
      customGroupName: form.mainType === 'custom' ? trimmedCustomGroup || undefined : undefined,
      name: trimmedName,
      sizeOrCapacity: trimmedSize || undefined,
      stockQty: !isCableType(form.mainType) ? form.stockQty : undefined,
      isCable: isCableType(form.mainType),
      cableCategory:
        form.mainType === 'kablo_ic'
          ? 'ic'
          : form.mainType === 'kablo_yeraltı'
          ? 'yeraltı'
          : form.mainType === 'kablo_havai'
          ? 'havai'
          : undefined,
      capacityLabel: trimmedCapacity || undefined,
      spoolId: trimmedSpoolId || undefined,
      lengthTotal: isCableType(form.mainType) ? form.lengthTotal : undefined,
      lengthRemaining: isCableType(form.mainType) ? form.lengthTotal : undefined,
    };

    return { ok: true, payload };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = validateAndBuildPayload();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const payload = result.payload;
    if (!payload) return;

    if (editing) {
      store.updateMaterialStock(editing.id, {
        ...payload,
        lengthRemaining:
          editing.lengthRemaining ?? payload.lengthRemaining ?? editing.lengthTotal ?? payload.lengthTotal,
      });
      setEditing(null);
    } else {
      store.addMaterialStock(payload);
    }
    setForm(INITIAL_FORM);
  };

  const handleEdit = (item: MaterialStockItem) => {
    setEditing(item);
    setError('');
    setForm({
      mainType: item.mainType,
      customGroupName: item.customGroupName ?? '',
      name: item.name,
      sizeOrCapacity: item.sizeOrCapacity ?? '',
      stockQty: item.stockQty ?? 0,
      capacityLabel: item.capacityLabel ?? '',
      spoolId: item.spoolId ?? '',
      lengthTotal: item.lengthTotal ?? item.lengthRemaining ?? 0,
    });
  };

  const handleDelete = (id: string) => {
    store.deleteMaterialStock(id);
  };

  const handleDistribute = (e: React.FormEvent) => {
    e.preventDefault();
    setDistError('');
    setDistSuccess('');
    if (!distTeamId || !distMaterialId || !selectedDistItem) {
      setDistError('validation.required');
      return;
    }
    const qty = Number(distQuantity) || 0;
    if (qty <= 0) {
      setDistError('validation.positiveNumber');
      return;
    }
    if (qty > distMaxAvailable) {
      setDistError('materials.distributeErrorMax');
      return;
    }
    const isCable = isCableType(selectedDistItem.mainType);
    if (isCable) {
      store.updateMaterialStock(selectedDistItem.id, {
        lengthRemaining: (selectedDistItem.lengthRemaining ?? 0) - qty,
      });
    } else {
      store.updateMaterialStock(selectedDistItem.id, {
        stockQty: (selectedDistItem.stockQty ?? 0) - qty,
      });
    }
    const allocations = store.getTeamMaterialAllocations(companyId, distTeamId);
    const existing = allocations.find((a) => a.materialStockItemId === distMaterialId);
    if (existing) {
      store.updateTeamMaterialAllocation(existing.id, {
        quantityMeters: isCable ? (existing.quantityMeters ?? 0) + qty : undefined,
        quantityPcs: !isCable ? (existing.quantityPcs ?? 0) + qty : undefined,
      });
    } else {
      store.addTeamMaterialAllocation({
        companyId,
        teamId: distTeamId,
        materialStockItemId: distMaterialId,
        quantityMeters: isCable ? qty : undefined,
        quantityPcs: !isCable ? qty : undefined,
      });
    }
    setDistSuccess('materials.distributeSuccess');
    setDistQuantity(0);
    setDistMaterialId('');
  };

  const renderTypeSelector = () => (
    <label className={styles.label}>
      {t('materials.mainTypeLabel')}
      <select
        className={styles.input}
        value={form.mainType}
        onChange={(e) => handleChange({ mainType: e.target.value as MaterialMainType })}
      >
        <option value="direk">{t('materials.typeDisplayDirek')}</option>
        <option value="kablo_ic">{t('materials.typeDisplayKabloIc')}</option>
        <option value="kablo_yeraltı">{t('materials.typeDisplayKabloYeralti')}</option>
        <option value="kablo_havai">{t('materials.typeDisplayKabloHavai')}</option>
        <option value="boru">{t('materials.typeDisplayBoru')}</option>
        <option value="fiber_bina_kutusu">{t('materials.typeDisplayFiberKutusu')}</option>
        <option value="ofsd">{t('materials.typeDisplayOFSD')}</option>
        <option value="sonlandirma_paneli">{t('materials.typeDisplaySonlandirmaPaneli')}</option>
        <option value="daire_sonlandirma_kutusu">{t('materials.typeDisplayDaireKutusu')}</option>
        <option value="menhol">{t('materials.typeDisplayMenhol')}</option>
        <option value="ek_odasi">{t('materials.typeDisplayEkOdasi')}</option>
        <option value="koruyucu_fider_borusu">{t('materials.typeDisplayKoruyucuFider')}</option>
        <option value="custom">{t('materials.typeDisplayCustom')}</option>
      </select>
    </label>
  );

  const renderTypeSpecificFields = () => {
    const mt = form.mainType;

    if (mt === 'direk' || mt === 'boru') {
      return (
        <>
          <label className={styles.label}>
            {mt === 'direk' ? t('materials.typeNameDirek') : t('materials.typeNameBoru')}
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              required
            />
          </label>
          <label className={styles.label}>
            {mt === 'direk' ? t('materials.sizeOrLengthDirek') : t('materials.sizeOrLengthBoru')}
            <input
              className={styles.input}
              value={form.sizeOrCapacity}
              onChange={(e) => handleChange({ sizeOrCapacity: e.target.value })}
              required
            />
          </label>
          <label className={styles.label}>
            {t('materials.stockQtyPcs')}
            <input
              type="number"
              min={0}
              className={styles.input}
              value={form.stockQty}
              onChange={(e) => handleChange({ stockQty: Number(e.target.value) || 0 })}
            />
          </label>
        </>
      );
    }

    if (isCableType(mt)) {
      const capacityKey =
        mt === 'kablo_ic' ? 'materials.cableCapacityIc' : mt === 'kablo_yeraltı' ? 'materials.cableCapacityYeralti' : 'materials.cableCapacityHavai';
      return (
        <>
          <label className={styles.label}>
            {t(capacityKey)}
            <input
              className={styles.input}
              value={form.capacityLabel}
              onChange={(e) => handleChange({ capacityLabel: e.target.value })}
              required
            />
          </label>
          <label className={styles.label}>
            {t('materials.spoolId')}
            <input
              className={styles.input}
              value={form.spoolId}
              onChange={(e) => handleChange({ spoolId: e.target.value })}
              required
            />
          </label>
          <label className={styles.label}>
            {t('materials.spoolLengthM')}
            <input
              type="number"
              min={1}
              className={styles.input}
              value={form.lengthTotal}
              onChange={(e) => handleChange({ lengthTotal: Number(e.target.value) || 0 })}
              required
            />
          </label>
        </>
      );
    }

    if (
      ['fiber_bina_kutusu', 'ofsd', 'sonlandirma_paneli', 'daire_sonlandirma_kutusu', 'menhol', 'ek_odasi', 'koruyucu_fider_borusu'].includes(
        mt,
      )
    ) {
      const labelKeys: Record<string, string> = {
        fiber_bina_kutusu: 'materials.labelFiberKutusu',
        ofsd: 'materials.labelOFSD',
        sonlandirma_paneli: 'materials.labelSonlandirmaPaneli',
        daire_sonlandirma_kutusu: 'materials.labelDaireKutusu',
        menhol: 'materials.labelMenhol',
        ek_odasi: 'materials.labelEkOdasi',
        koruyucu_fider_borusu: 'materials.labelKoruyucuFider',
      };
      return (
        <>
          <label className={styles.label}>
            {t(labelKeys[mt])}
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => handleChange({ name: e.target.value })}
              required
            />
          </label>
          {['fiber_bina_kutusu', 'ofsd', 'sonlandirma_paneli', 'daire_sonlandirma_kutusu'].includes(mt) && (
            <label className={styles.label}>
              {t('materials.capacityExample')}
              <input
                className={styles.input}
                value={form.sizeOrCapacity}
                onChange={(e) => handleChange({ sizeOrCapacity: e.target.value })}
              />
            </label>
          )}
          <label className={styles.label}>
            {t('materials.stockQtyPcs')}
            <input
              type="number"
              min={0}
              className={styles.input}
              value={form.stockQty}
              onChange={(e) => handleChange({ stockQty: Number(e.target.value) || 0 })}
            />
          </label>
        </>
      );
    }

    // custom
    return (
      <>
        <label className={styles.label}>
          {t('materials.customTypeName')}
          <input
            className={styles.input}
            value={form.customGroupName}
            onChange={(e) => handleChange({ customGroupName: e.target.value })}
            placeholder={t('materials.customPlaceholder')}
            required
          />
        </label>
        <label className={styles.label}>
          {t('materials.materialNameDesc')}
          <input
            className={styles.input}
            value={form.name}
            onChange={(e) => handleChange({ name: e.target.value })}
            required
          />
        </label>
        <label className={styles.label}>
          {t('materials.sizeCapacity')}
          <input
            className={styles.input}
            value={form.sizeOrCapacity}
            onChange={(e) => handleChange({ sizeOrCapacity: e.target.value })}
          />
        </label>
        <label className={styles.label}>
          {t('materials.stockQty')}
          <input
            type="number"
            min={0}
            className={styles.input}
            value={form.stockQty}
            onChange={(e) => handleChange({ stockQty: Number(e.target.value) || 0 })}
          />
        </label>
      </>
    );
  };

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('catalog.materials')}</h3>
        <button type="button" className={styles.primaryBtn} onClick={handleStartNew}>
          {editing ? t('catalog.editMaterial') : t('catalog.addMaterial')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {renderTypeSelector()}
        {renderTypeSpecificFields()}

        {error && <p className={styles.saveError}>{t(error)}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.primaryBtn}>
            {t('common.save')}
          </button>
        </div>
      </form>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('materials.tableType')}</th>
            <th>{t('materials.tableNameDesc')}</th>
            <th>{t('materials.tableSizeCapacity')}</th>
            <th>{t('materials.tableStockM')}</th>
            <th>{t('materials.tableSpoolId')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {itemsForSelectedType.map((item) => {
            const typeDisplayKeys: Record<MaterialMainType, string> = {
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
            return (
              <tr key={item.id}>
                <td>{t(typeDisplayKeys[item.mainType])}</td>
              <td>{item.name}</td>
              <td>{item.sizeOrCapacity ?? item.capacityLabel ?? '-'}</td>
              <td>
                {isCableType(item.mainType)
                  ? `${item.lengthRemaining ?? item.lengthTotal ?? 0} m`
                  : item.stockQty ?? 0}
              </td>
              <td>{item.spoolId ?? '-'}</td>
              <td>
                <button type="button" className={styles.smallBtnEdit} onClick={() => handleEdit(item)}>
                  {t('common.edit')}
                </button>
                <button type="button" className={styles.smallBtnDanger} onClick={() => handleDelete(item.id)}>
                  {t('common.delete')}
                </button>
              </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {itemsForSelectedType.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}

      <div className={styles.toolbar} style={{ marginTop: '1.5rem' }}>
        <h3 className={styles.sectionTitle}>{t('materials.distributeToTeam')}</h3>
      </div>
      <form onSubmit={handleDistribute} className={styles.form}>
        <label className={styles.label}>
          {t('materials.selectTeam')}
          <select
            className={styles.input}
            value={distTeamId}
            onChange={(e) => { setDistTeamId(e.target.value); setDistError(''); setDistSuccess(''); }}
          >
            <option value="">—</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.code}{team.description ? ` — ${team.description}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          {t('materials.selectMaterial')}
          <select
            className={styles.input}
            value={distMaterialId}
            onChange={(e) => {
              setDistMaterialId(e.target.value);
              setDistQuantity(0);
              setDistError('');
              setDistSuccess('');
            }}
          >
            <option value="">—</option>
            {itemsWithStock.map((item) => {
              const rem = isCableType(item.mainType)
                ? (item.lengthRemaining ?? 0)
                : (item.stockQty ?? 0);
              const label = item.spoolId
                ? `${item.spoolId} — ${rem} m`
                : `${item.name ?? item.capacityLabel ?? item.id} — ${rem}`;
              return (
                <option key={item.id} value={item.id}>{label}</option>
              );
            })}
          </select>
          {selectedDistItem && (
            <span className={styles.helper}> ({t('materials.maxAvailable')}: {distMaxAvailable}{isCableType(selectedDistItem.mainType) ? ' m' : ''})</span>
          )}
        </label>
        <label className={styles.label}>
          {selectedDistItem && isCableType(selectedDistItem.mainType) ? t('materials.quantityMeters') : t('materials.quantityPcs')}
          <input
            type="number"
            min={0}
            max={distMaxAvailable}
            className={styles.input}
            value={distQuantity || ''}
            onChange={(e) => setDistQuantity(Number(e.target.value) || 0)}
            placeholder="0"
          />
        </label>
        {distError && <p className={styles.saveError}>{t(distError)}</p>}
        {distSuccess && <p style={{ color: 'var(--color-success, green)' }}>{t(distSuccess)}</p>}
        <div className={styles.formActions}>
          <button type="submit" className={styles.primaryBtn} disabled={!distTeamId || !distMaterialId || distQuantity <= 0}>
            {t('materials.distribute')}
          </button>
        </div>
      </form>
    </Card>
  );
}

