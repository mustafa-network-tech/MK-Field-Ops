import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { Card } from '../ui/Card';
import type { MaterialAuditActionType, MaterialMainType } from '../../types';
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

const ACTION_TYPES: MaterialAuditActionType[] = [
  'STOCK_ADD',
  'STOCK_EDIT',
  'STOCK_DELETE',
  'DISTRIBUTE_TO_TEAM',
  'RETURN_TO_STOCK',
  'TRANSFER_BETWEEN_TEAMS',
  'STOCK_ADJUSTMENT',
];

export function AuditLogTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const [filterAction, setFilterAction] = useState<MaterialAuditActionType | ''>('');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const teams = store.getTeams(companyId);
  const users = store.getUsers(companyId);
  const stockItems = store.getMaterialStock(companyId);

  const entries = useMemo(() => {
    return store.getMaterialAuditLog(companyId, {
      actionType: filterAction || undefined,
      teamId: filterTeamId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
  }, [companyId, filterAction, filterTeamId, fromDate, toDate]);

  const getActorName = (userId: string) => users.find((u) => u.id === userId)?.fullName ?? userId;
  const getMaterialLabel = (materialId: string) => {
    const item = stockItems.find((m) => m.id === materialId);
    if (!item) return materialId;
    const typeLabel = t(TYPE_DISPLAY_KEYS[item.mainType]);
    const namePart = item.spoolId ? `${item.name ?? item.capacityLabel} (${item.spoolId})` : (item.name ?? item.capacityLabel ?? materialId);
    return `${typeLabel} — ${namePart}`;
  };
  const getTeamCode = (teamId: string) => teams.find((te) => te.id === teamId)?.code ?? teamId;

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('audit.title')}</h3>
      </div>
      <div className={styles.form} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
        <label className={styles.label}>
          {t('audit.filterByAction')}
          <select
            className={styles.input}
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value as MaterialAuditActionType | '')}
            style={{ maxWidth: 200 }}
          >
            <option value="">—</option>
            {ACTION_TYPES.map((type) => (
              <option key={type} value={type}>{t(`audit.${type}`)}</option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          {t('audit.filterByTeam')}
          <select
            className={styles.input}
            value={filterTeamId}
            onChange={(e) => setFilterTeamId(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">—</option>
            {teams.map((te) => (
              <option key={te.id} value={te.id}>{te.code}{te.description ? ` — ${te.description}` : ''}</option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          {t('audit.filterByDate')} (from)
          <input
            type="date"
            className={styles.input}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ maxWidth: 160 }}
          />
        </label>
        <label className={styles.label}>
          (to)
          <input
            type="date"
            className={styles.input}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ maxWidth: 160 }}
          />
        </label>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('audit.date')}</th>
            <th>{t('audit.actionType')}</th>
            <th>{t('audit.actor')}</th>
            <th>{t('audit.material')}</th>
            <th>{t('audit.fromTeam')}</th>
            <th>{t('audit.toTeam')}</th>
            <th>{t('audit.qty')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '–'}</td>
              <td>{`${t(`audit.${e.actionType}`)} (${getActorName(e.actorUserId)})`}</td>
              <td>{getActorName(e.actorUserId)}</td>
              <td>{getMaterialLabel(e.materialStockItemId)}</td>
              <td>{e.fromTeamId ? getTeamCode(e.fromTeamId) : '–'}</td>
              <td>{e.toTeamId ? getTeamCode(e.toTeamId) : '–'}</td>
              <td>
                {e.qtyMeters != null ? `${e.qtyMeters} m` : e.qtyCount != null ? `${e.qtyCount}` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
    </Card>
  );
}
