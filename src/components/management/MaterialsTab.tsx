import React, { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { materialStockService } from '../../services/materialStockService';
import { Card } from '../ui/Card';
import type { MaterialMainType } from '../../types';
import styles from './ManagementTabs.module.css';

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

export function MaterialsTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const canManageStock = user?.role === 'companyManager' || user?.role === 'projectManager';

  const isCableType = (mainType: MaterialMainType) =>
    mainType === 'kablo_ic' || mainType === 'kablo_yeraltı' || mainType === 'kablo_havai';
  /** Kablo + boru: stok metre ile (lengthRemaining). */
  const isMeterType = (mainType: MaterialMainType) => mainType === 'boru' || isCableType(mainType);

  const allItems = store.getMaterialStock(companyId);
  const teams = store.getTeams(companyId);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [distTeamId, setDistTeamId] = useState('');
  const [distMaterialId, setDistMaterialId] = useState('');
  const [distQuantity, setDistQuantity] = useState<number>(0);
  const [distError, setDistError] = useState('');
  const [distSuccess, setDistSuccess] = useState('');

  /** Stok listesi: forma bağlı değil; sadece arama metnine göre filtrelenir */
  const stockListFiltered = useMemo(() => {
    const q = stockSearchQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((m) => {
      const name = (m.name ?? '').toLowerCase();
      const typeKey = TYPE_DISPLAY_KEYS[m.mainType];
      const typeStr = typeKey ? t(typeKey).toLowerCase() : '';
      const spool = (m.spoolId ?? '').toLowerCase();
      const cap = (m.capacityLabel ?? m.sizeOrCapacity ?? '').toLowerCase();
      return name.includes(q) || typeStr.includes(q) || spool.includes(q) || cap.includes(q);
    });
  }, [allItems, stockSearchQuery, t]);

  /** Dağıtım için: stokta kalanı olan malzemeler (metre türleri: lengthRemaining > 0, diğer: stockQty > 0) */
  const itemsWithStock = useMemo(
    () =>
      allItems.filter((m) =>
        isMeterType(m.mainType)
          ? (m.lengthRemaining ?? 0) > 0
          : (m.stockQty ?? 0) > 0,
      ),
    [allItems],
  );
  const selectedDistItem = distMaterialId ? allItems.find((m) => m.id === distMaterialId) : null;
  const distMaxAvailable = selectedDistItem
    ? isMeterType(selectedDistItem.mainType)
      ? selectedDistItem.lengthRemaining ?? 0
      : selectedDistItem.stockQty ?? 0
    : 0;

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
    const isCable = isMeterType(selectedDistItem.mainType);
    const res = materialStockService.distributeToTeam(
      companyId,
      {
        teamId: distTeamId,
        materialStockItemId: distMaterialId,
        quantityMeters: isCable ? qty : undefined,
        quantityPcs: !isCable ? qty : undefined,
      },
      user
    );
    if (!res.ok) {
      setDistError(res.error);
      return;
    }
    setDistSuccess('materials.distributeSuccess');
    setDistQuantity(0);
    setDistMaterialId('');
  };

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('materials.stockListTitle')}</h3>
      </div>
      <p className={styles.muted} style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>{t('materials.stockFromDeliveryNotes')}</p>
      <label className={styles.label}>
        {t('materials.stockSearchLabel')}
        <input
          type="text"
          className={styles.input}
          value={stockSearchQuery}
          onChange={(e) => setStockSearchQuery(e.target.value)}
          placeholder={t('materials.stockSearchPlaceholder')}
        />
      </label>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('materials.tableType')}</th>
            <th>{t('materials.tableNameDesc')}</th>
            <th>{t('materials.tableSizeCapacity')}</th>
            <th>{t('materials.tableStockM')}</th>
            <th>{t('materials.tableSpoolId')}</th>
          </tr>
        </thead>
        <tbody>
          {stockListFiltered.map((item) => (
            <tr key={item.id}>
              <td>{t(TYPE_DISPLAY_KEYS[item.mainType])}</td>
              <td>{item.name}</td>
              <td>{item.sizeOrCapacity ?? item.capacityLabel ?? '-'}</td>
              <td>
                {isMeterType(item.mainType)
                  ? `${item.lengthRemaining ?? item.lengthTotal ?? 0} m`
                  : item.stockQty ?? 0}
              </td>
              <td>{item.spoolId ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stockListFiltered.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}

      {canManageStock && (
        <>
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
              const rem = isMeterType(item.mainType)
                ? (item.lengthRemaining ?? 0)
                : (item.stockQty ?? 0);
              const typeLabel = t(TYPE_DISPLAY_KEYS[item.mainType]);
              const namePart = item.spoolId
                ? `${item.name ?? item.capacityLabel} (${item.spoolId})`
                : (item.name ?? item.sizeOrCapacity ?? item.capacityLabel ?? item.id);
              const label = isMeterType(item.mainType)
                ? `${typeLabel} — ${namePart} — ${rem} m`
                : `${typeLabel} — ${namePart} — ${rem}`;
              return (
                <option key={item.id} value={item.id}>{label}</option>
              );
            })}
          </select>
          {selectedDistItem && (
            <span className={styles.helper}> ({t('materials.maxAvailable')}: {distMaxAvailable}{isMeterType(selectedDistItem.mainType) ? ' m' : ''})</span>
          )}
        </label>
        <label className={styles.label}>
          {selectedDistItem && isMeterType(selectedDistItem.mainType) ? t('materials.quantityMeters') : t('materials.quantityPcs')}
          <input
            type="number"
            min={0}
            step={1}
            max={distMaxAvailable}
            className={styles.input}
            value={distQuantity || ''}
            onChange={(e) => setDistQuantity(Math.floor(Number(e.target.value) || 0))}
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
        </>
      )}
    </Card>
  );
}

