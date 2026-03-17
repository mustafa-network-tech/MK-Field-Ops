import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
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

export function AuditLogTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';

  const teams = store.getTeams(companyId);
  const users = store.getUsers(companyId);
  const stockItems = store.getMaterialStock(companyId);

  const entries = useMemo(() => {
    return store
      .getMaterialAuditLog(companyId)
      .filter((e) => e.actionType === 'DISTRIBUTE_TO_TEAM' || e.actionType === 'DELIVERY_NOTE_RECEIVE');
  }, [companyId]);

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
      <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('audit.date')}</th>
            <th>{t('audit.operation')}</th>
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
              <td>
                {e.actionType === 'DISTRIBUTE_TO_TEAM'
                  ? t('audit.operationTeamDistribute')
                  : `${t('audit.operationDeliveryNote')} ${
                      e.note && e.note.trim() ? `(${e.note.trim()})` : ''
                    }`}
              </td>
              <td>{getActorName(e.actorUserId)}</td>
              <td>{e.actionType === 'DISTRIBUTE_TO_TEAM' ? getMaterialLabel(e.materialStockItemId) : '–'}</td>
              <td>
                {e.actionType === 'DISTRIBUTE_TO_TEAM'
                  ? e.fromTeamId
                    ? getTeamCode(e.fromTeamId)
                    : t('audit.sourceDepot')
                  : '–'}
              </td>
              <td>{e.actionType === 'DISTRIBUTE_TO_TEAM' && e.toTeamId ? getTeamCode(e.toTeamId) : '–'}</td>
              <td>
                {e.actionType === 'DISTRIBUTE_TO_TEAM'
                  ? e.qtyMeters != null
                    ? `${e.qtyMeters} m`
                    : e.qtyCount != null
                      ? `${e.qtyCount}`
                      : '–'
                  : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {entries.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
    </Card>
  );
}
