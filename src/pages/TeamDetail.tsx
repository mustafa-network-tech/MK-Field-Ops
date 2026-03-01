import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { materialStockService } from '../services/materialStockService';
import { getTeamForUser } from '../services/teamScopeService';
import { getTeamDetailSummary } from '../services/teamDetailService';
import { formatPriceForUser } from '../utils/priceRules';
import { formatCurrency } from '../utils/formatLocale';
import { Card } from '../components/ui/Card';
import type { MaterialMainType } from '../types';
import styles from './TeamDetail.module.css';

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

export function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const [refreshKey, setRefreshKey] = useState(0);
  const [zimmetError, setZimmetError] = useState('');
  const [zimmetSuccess, setZimmetSuccess] = useState('');
  const [returnAllocationId, setReturnAllocationId] = useState<string | null>(null);
  const [returnQuantity, setReturnQuantity] = useState('');
  const [transferAllocationId, setTransferAllocationId] = useState<string | null>(null);
  const [transferTargetTeamId, setTransferTargetTeamId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');

  const teamResult = teamId && user ? getTeamForUser(teamId, user) : { ok: false as const, statusCode: 404 as const };
  const team = teamResult.ok ? teamResult.team : undefined;
  const workItems = store.getWorkItems(companyId);
  const detail = teamId && user ? getTeamDetailSummary(companyId, teamId, user) : null;
  const allocations = useMemo(
    () => (teamId && companyId ? store.getTeamMaterialAllocations(companyId, teamId) : []),
    [companyId, teamId, refreshKey]
  );
  const stockItems = store.getMaterialStock(companyId);
  const teams = store.getTeams(companyId);
  const otherTeams = teams.filter((te) => te.id !== teamId);

  if (!teamId || !team) {
    const is403 = !teamResult.ok && teamResult.statusCode === 403;
    return (
      <div className={styles.page}>
        <p>{is403 ? t('errors.forbidden') : t('common.noData')}</p>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/management')}>{t('common.back')}</button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={styles.page}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/management')}>{t('common.back')}</button>
        <p className={styles.noData}>{t('common.noData')}</p>
      </div>
    );
  }

  const isAdmin = detail.role === 'companyManager' || detail.role === 'projectManager';
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;
  const maxTeam = Math.max(
    isAdmin ? (detail.weekly as { team: number }).team : detail.weekly.team,
    isAdmin ? (detail.monthly as { team: number }).team : detail.monthly.team,
    1
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/management')}>{t('common.back')}</button>
        <h1 className={styles.title}>{team.code} – {t('teamDetail.title')}</h1>
      </div>

      {/* Top stats: admin = 3 (Gross / Team / Company) + jobs/pending/approved; TL = Team + jobs/pending/approved */}
      <div className={styles.statsGrid}>
        {isAdmin ? (
          <>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>{t('jobs.totalWorkValue')}</span>
              <span className={styles.statValue}>{formatCurrency(detail.grossTotal, locale)}</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>{t('jobs.teamEarnings')}</span>
              <span className={styles.statValue}>{formatCurrency(detail.teamTotal, locale)}</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statLabel}>{t('jobs.companyShare')}</span>
              <span className={styles.statValue}>{formatCurrency(detail.companyTotal, locale)}</span>
            </div>
          </>
        ) : (
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>{t('teamDetail.totalEarnings')}</span>
            <span className={styles.statValue}>{formatPriceForUser(detail.teamTotal, user, 'teamOnly', locale)}</span>
          </div>
        )}
        <div className={styles.statBlock}>
          <span className={styles.statLabel}>{t('teamDetail.totalJobs')}</span>
          <span className={styles.statValue}>{detail.totalJobs}</span>
        </div>
        <div className={styles.statBlock}>
          <span className={styles.statLabel}>{t('teamDetail.pendingApprovals')}</span>
          <span className={styles.statValue}>{detail.pendingCount}</span>
        </div>
        <div className={styles.statBlock}>
          <span className={styles.statLabel}>{t('teamDetail.approvedJobs')}</span>
          <span className={styles.statValue}>{detail.approvedCount}</span>
        </div>
      </div>

      <Card title={t('teamDetail.performance')}>
        <div className={styles.barSection}>
          <div className={styles.barRow}>
            <span className={styles.barLabel}>{t('reports.weekly')}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${((isAdmin ? (detail.weekly as { team: number }).team : detail.weekly.team) / maxTeam) * 100}%` }} />
            </div>
            <span className={styles.barValue}>
              {formatPriceForUser(isAdmin ? (detail.weekly as { team: number }).team : detail.weekly.team, user, 'teamOnly', locale)}
            </span>
          </div>
          <div className={styles.barRow}>
            <span className={styles.barLabel}>{t('reports.monthly')}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${((isAdmin ? (detail.monthly as { team: number }).team : detail.monthly.team) / maxTeam) * 100}%` }} />
            </div>
            <span className={styles.barValue}>
              {formatPriceForUser(isAdmin ? (detail.monthly as { team: number }).team : detail.monthly.team, user, 'teamOnly', locale)}
            </span>
          </div>
        </div>
      </Card>

      <div className={styles.summaryRow}>
        {isAdmin ? (
          <>
            <Card title={t('teamDetail.weeklySummary')}>
              <p className={styles.meta}>{t('jobs.totalWorkValue')}: {formatCurrency(detail.weekly.gross, locale)}</p>
              <p className={styles.meta}>{t('jobs.teamEarnings')}: {formatCurrency(detail.weekly.team, locale)}</p>
              <p className={styles.meta}>{t('jobs.companyShare')}: {formatCurrency(detail.weekly.company, locale)}</p>
            </Card>
            <Card title={t('teamDetail.monthlySummary')}>
              <p className={styles.meta}>{t('jobs.totalWorkValue')}: {formatCurrency(detail.monthly.gross, locale)}</p>
              <p className={styles.meta}>{t('jobs.teamEarnings')}: {formatCurrency(detail.monthly.team, locale)}</p>
              <p className={styles.meta}>{t('jobs.companyShare')}: {formatCurrency(detail.monthly.company, locale)}</p>
            </Card>
          </>
        ) : (
          <>
            <Card title={t('teamDetail.weeklySummary')}>
              <p className={styles.summaryValue}>{formatPriceForUser(detail.weekly.team, user, 'teamOnly', locale)}</p>
            </Card>
            <Card title={t('teamDetail.monthlySummary')}>
              <p className={styles.summaryValue}>{formatPriceForUser(detail.monthly.team, user, 'teamOnly', locale)}</p>
            </Card>
          </>
        )}
      </div>

      <Card title={t('teamDetail.jobBreakdown')}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('jobs.date')}</th>
                <th>{t('jobs.workItem')}</th>
                <th>{t('jobs.quantity')}</th>
                {isAdmin && (
                  <>
                    <th>{t('jobs.totalWorkValue')}</th>
                    <th>{t('jobs.teamEarnings')}</th>
                    <th>{t('jobs.companyShare')}</th>
                  </>
                )}
                {!isAdmin && <th>{t('jobs.teamEarnings')}</th>}
              </tr>
            </thead>
            <tbody>
              {isAdmin
                ? detail.jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{new Date(j.date).toLocaleDateString()}</td>
                      <td>{getWorkItemCode(j.workItemId)}</td>
                      <td>{j.quantity}</td>
                      <td>{formatCurrency(j.gross, locale)}</td>
                      <td>{formatCurrency(j.team, locale)}</td>
                      <td>{formatCurrency(j.company, locale)}</td>
                    </tr>
                  ))
                : detail.jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{new Date(j.date).toLocaleDateString()}</td>
                      <td>{getWorkItemCode(j.workItemId)}</td>
                      <td>{j.quantity}</td>
                      <td>{formatPriceForUser(j.team, user, 'teamOnly', locale)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {detail.jobs.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
      </Card>

      <Card title={t('materials.assignedMaterials')}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('materials.tableType')}</th>
                <th>{t('materials.tableNameDesc')}</th>
                <th>{t('materials.tableSpoolId')}</th>
                <th>{t('materials.quantityMeters')}</th>
                <th>{t('materials.quantityPcs')}</th>
                <th>{t('materials.assignedDate')}</th>
                {isAdmin && <th>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {allocations.map((alloc) => {
                const material = stockItems.find((m) => m.id === alloc.materialStockItemId);
                const isMeter = material && (material.mainType === 'boru' || material.mainType === 'kablo_ic' || material.mainType === 'kablo_yeraltı' || material.mainType === 'kablo_havai');
                const maxReturn = isMeter ? (alloc.quantityMeters ?? 0) : (alloc.quantityPcs ?? 0);
                const showReturnInput = isAdmin && returnAllocationId === alloc.id;
                const showTransfer = isAdmin && transferAllocationId === alloc.id && otherTeams.length > 0;
                return (
                  <tr key={alloc.id}>
                    <td>{material ? t(TYPE_DISPLAY_KEYS[material.mainType]) : '–'}</td>
                    <td>{material ? `${t(TYPE_DISPLAY_KEYS[material.mainType])} — ${material.name ?? material.capacityLabel ?? material.sizeOrCapacity ?? alloc.materialStockItemId}` : alloc.materialStockItemId}</td>
                    <td>{material?.spoolId ?? '–'}</td>
                    <td>{isMeter ? (alloc.quantityMeters ?? 0) : '–'}</td>
                    <td>{!isMeter ? (alloc.quantityPcs ?? 0) : '–'}</td>
                    <td>{alloc.createdAt ? new Date(alloc.createdAt).toLocaleDateString() : '–'}</td>
                    {isAdmin && (
                      <td>
                        {!showReturnInput ? (
                          <button
                            type="button"
                            className={styles.backBtn}
                            style={{ marginRight: 8 }}
                            onClick={() => {
                              setReturnAllocationId(alloc.id);
                              setReturnQuantity(maxReturn > 0 ? String(maxReturn) : '');
                              setZimmetError('');
                              setZimmetSuccess('');
                            }}
                          >
                            {t('materials.returnToStock')}
                          </button>
                        ) : (
                          <>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              max={maxReturn}
                              value={returnQuantity}
                              onChange={(e) => {
                                const v = Math.floor(Number(e.target.value) || 0);
                                setReturnQuantity(v >= 0 ? String(v) : e.target.value);
                              }}
                              placeholder={isMeter ? t('materials.quantityMeters') : t('materials.quantityPcs')}
                              style={{ width: 80, marginRight: 8, padding: '4px 8px' }}
                            />
                            <span style={{ marginRight: 8, fontSize: '0.85rem', color: '#64748b' }}>
                              {isMeter ? ' m' : ''} ({t('materials.maxShort')}: {maxReturn})
                            </span>
                            <button
                              type="button"
                              className={styles.backBtn}
                              style={{ marginRight: 8 }}
                              onClick={() => {
                                const q = Number(returnQuantity) || 0;
                                if (q <= 0 || q > maxReturn) {
                                  setZimmetError(t('materials.errors.amountExceedsAllocation'));
                                  return;
                                }
                                const res = materialStockService.returnToStock(
                                  companyId,
                                  alloc.id,
                                  isMeter ? { quantityMeters: q } : { quantityPcs: q },
                                  user
                                );
                                if (res.ok) {
                                  setZimmetSuccess(t('materials.returnSuccess'));
                                  setReturnAllocationId(null);
                                  setReturnQuantity('');
                                  setRefreshKey((k) => k + 1);
                                } else {
                                  setZimmetError(t(res.error));
                                }
                              }}
                            >
                              {t('materials.confirmReturn')}
                            </button>
                            <button
                              type="button"
                              className={styles.backBtn}
                              onClick={() => {
                                setReturnAllocationId(null);
                                setReturnQuantity('');
                              }}
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        )}
                        {!showTransfer ? (
                          !showReturnInput && (
                            <button
                              type="button"
                              className={styles.backBtn}
                              onClick={() => {
                                setTransferAllocationId(alloc.id);
                                setTransferTargetTeamId('');
                                setTransferQuantity(isMeter ? String(alloc.quantityMeters ?? 0) : String(alloc.quantityPcs ?? 0));
                                setZimmetError('');
                                setZimmetSuccess('');
                              }}
                            >
                              {t('materials.transferToTeam')}
                            </button>
                          )
                        ) : (
                          <>
                            <select
                              value={transferTargetTeamId}
                              onChange={(e) => setTransferTargetTeamId(e.target.value)}
                              style={{ marginRight: 8, padding: '4px 8px' }}
                            >
                              <option value="">{t('materials.transferToTeamSelect')}</option>
                              {otherTeams.map((te) => (
                                <option key={te.id} value={te.id}>
                                  {te.code}{te.description ? ` — ${te.description}` : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              max={isMeter ? (alloc.quantityMeters ?? 0) : (alloc.quantityPcs ?? 0)}
                              value={transferQuantity}
                              onChange={(e) => {
                                const v = Math.floor(Number(e.target.value) || 0);
                                setTransferQuantity(v >= 0 ? String(v) : e.target.value);
                              }}
                              style={{ width: 80, marginRight: 8, padding: '4px 8px' }}
                            />
                            <span style={{ marginRight: 8, fontSize: '0.85rem', color: '#64748b' }}>
                              {isMeter ? ' m' : ''}
                            </span>
                            <button
                              type="button"
                              className={styles.backBtn}
                              style={{ marginRight: 8 }}
                              onClick={() => {
                                if (!transferTargetTeamId) {
                                  setZimmetError(t('validation.required'));
                                  return;
                                }
                                const maxT = isMeter ? (alloc.quantityMeters ?? 0) : (alloc.quantityPcs ?? 0);
                                const q = Math.floor(Number(transferQuantity) || 0);
                                if (q <= 0 || q > maxT) {
                                  setZimmetError(t('materials.errors.amountExceedsAllocation'));
                                  return;
                                }
                                const res = materialStockService.transferToTeam(
                                  companyId,
                                  {
                                    allocationId: alloc.id,
                                    targetTeamId: transferTargetTeamId,
                                    quantityMeters: isMeter ? q : undefined,
                                    quantityPcs: !isMeter ? q : undefined,
                                  },
                                  user
                                );
                                if (res.ok) {
                                  setZimmetSuccess(t('materials.transferSuccess'));
                                  setTransferAllocationId(null);
                                  setTransferTargetTeamId('');
                                  setTransferQuantity('');
                                  setRefreshKey((k) => k + 1);
                                } else {
                                  setZimmetError(t(res.error));
                                }
                              }}
                            >
                              {t('materials.confirmTransfer')}
                            </button>
                            <button
                              type="button"
                              className={styles.backBtn}
                              onClick={() => {
                                setTransferAllocationId(null);
                                setTransferTargetTeamId('');
                                setTransferQuantity('');
                              }}
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {allocations.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
        {zimmetError && <p style={{ color: '#dc2626', marginTop: 8 }}>{zimmetError}</p>}
        {zimmetSuccess && <p style={{ color: 'green', marginTop: 8 }}>{zimmetSuccess}</p>}
      </Card>
    </div>
  );
}
