/**
 * Malzeme stok ve zimmet işlemleri: rol kontrolü + denetim kaydı.
 * Sadece Company Manager ve Project Manager stok/dağıtım mutasyonu yapabilir.
 */
import { store } from '../data/store';
import {
  deleteTeamMaterialAllocationFromSupabase,
  syncMaterialStockItemToSupabase,
  upsertTeamMaterialAllocationToSupabase,
} from './supabaseSyncService';
import { logEvent, actorFromUser } from './auditLogService';
import type { User, MaterialStockItem, MaterialAuditActionType } from '../types';

function isManager(user: User | undefined): boolean {
  return user?.role === 'companyManager' || user?.role === 'projectManager';
}

function writeAudit(
  companyId: string,
  actionType: MaterialAuditActionType,
  user: User,
  materialStockItemId: string,
  opts: {
    fromTeamId?: string | null;
    toTeamId?: string | null;
    qtyCount?: number | null;
    qtyMeters?: number | null;
    spoolId?: string | null;
    note?: string | null;
  }
): void {
  store.addMaterialAuditLog({
    companyId,
    actionType,
    actorUserId: user.id,
    actorRole: user.role ?? '',
    materialStockItemId,
    fromTeamId: opts.fromTeamId ?? null,
    toTeamId: opts.toTeamId ?? null,
    qtyCount: opts.qtyCount ?? null,
    qtyMeters: opts.qtyMeters ?? null,
    spoolId: opts.spoolId ?? null,
    note: opts.note ?? null,
  });
}

function isCableType(mainType: string): boolean {
  return mainType === 'kablo_ic' || mainType === 'kablo_yeraltı' || mainType === 'kablo_havai';
}

function isMeterType(mainType: string): boolean {
  return mainType === 'boru' || isCableType(mainType);
}

/** Aynı ad + tür + kapasite için mevcut kalem (adet türleri). Kablo spool ile ayrı satır; boru metre ile merge. */
function findExistingNonCable(
  companyId: string,
  payload: Omit<MaterialStockItem, 'id' | 'createdAt'>
): MaterialStockItem | undefined {
  const list = store.getMaterialStock(companyId);
  const nameKey = (payload.name ?? '').trim().toLowerCase();
  const capacityKey = (payload.sizeOrCapacity ?? payload.capacityLabel ?? '').trim().toLowerCase();
  return list.find((m) => {
    if (m.companyId !== companyId || m.mainType !== payload.mainType) return false;
    if ((m.name ?? '').trim().toLowerCase() !== nameKey) return false;
    if ((m.sizeOrCapacity ?? m.capacityLabel ?? '').trim().toLowerCase() !== capacityKey) return false;
    if (payload.mainType === 'custom' && (payload.customGroupName ?? '') !== (m.customGroupName ?? '')) return false;
    return !isCableType(m.mainType) && m.mainType !== 'boru';
  });
}

/** Boru: aynı ad + ebat için mevcut kalem (metre üzerine eklenir). */
function findExistingBoru(
  companyId: string,
  payload: Omit<MaterialStockItem, 'id' | 'createdAt'>
): MaterialStockItem | undefined {
  const list = store.getMaterialStock(companyId);
  const nameKey = (payload.name ?? '').trim().toLowerCase();
  const capacityKey = (payload.sizeOrCapacity ?? '').trim().toLowerCase();
  return list.find(
    (m) =>
      m.companyId === companyId &&
      m.mainType === 'boru' &&
      (m.name ?? '').trim().toLowerCase() === nameKey &&
      (m.sizeOrCapacity ?? '').trim().toLowerCase() === capacityKey
  );
}

export const materialStockService = {
  addMaterialStock(
    companyId: string,
    payload: Omit<MaterialStockItem, 'id' | 'createdAt'>,
    user: User | undefined
  ): { ok: true; item: MaterialStockItem } | { ok: false; error: string } {
    if (!isManager(user)) return { ok: false, error: 'materials.errors.teamLeaderCannotMutate' };

    // Kablo: her makara (spool) ayrı satır; yeni kayıt eklenir.
    if (isCableType(payload.mainType)) {
      const item = store.addMaterialStock({ ...payload, companyId });
      writeAudit(companyId, 'STOCK_ADD', user!, item.id, {
        qtyCount: payload.stockQty ?? null,
        qtyMeters: payload.lengthTotal ?? payload.lengthRemaining ?? null,
        spoolId: payload.spoolId ?? null,
      });
      void syncMaterialStockItemToSupabase(companyId, item.id).catch(() => {});
      return { ok: true, item };
    }

    // Boru: aynı ad + ebat varsa mevcut kaleme metre eklenir.
    if (payload.mainType === 'boru') {
      const addM = payload.lengthTotal ?? payload.lengthRemaining ?? 0;
      if (addM <= 0) return { ok: false, error: 'validation.positiveNumber' };
      const existingBoru = findExistingBoru(companyId, payload);
      if (existingBoru) {
        const newTotal = (existingBoru.lengthTotal ?? 0) + addM;
        const newRem = (existingBoru.lengthRemaining ?? 0) + addM;
        const updated = store.updateMaterialStock(existingBoru.id, { lengthTotal: newTotal, lengthRemaining: newRem });
        if (!updated) return { ok: false, error: 'common.noData' };
        writeAudit(companyId, 'STOCK_EDIT', user!, existingBoru.id, { qtyMeters: newRem, note: `+${addM} m eklendi` });
        void syncMaterialStockItemToSupabase(companyId, existingBoru.id).catch(() => {});
        return { ok: true, item: updated };
      }
      const item = store.addMaterialStock({ ...payload, companyId });
      writeAudit(companyId, 'STOCK_ADD', user!, item.id, { qtyMeters: payload.lengthTotal ?? payload.lengthRemaining ?? null });
      void syncMaterialStockItemToSupabase(companyId, item.id).catch(() => {});
      return { ok: true, item };
    }

    // Kablo/boru dışı: aynı ad + tür + kapasite varsa mevcut kaleme adet eklenir.
    const existing = findExistingNonCable(companyId, payload);
    if (existing) {
      const addQty = payload.stockQty ?? 0;
      if (addQty <= 0) return { ok: false, error: 'validation.positiveNumber' };
      const newQty = (existing.stockQty ?? 0) + addQty;
      const updated = store.updateMaterialStock(existing.id, { stockQty: newQty });
      if (!updated) return { ok: false, error: 'common.noData' };
      writeAudit(companyId, 'STOCK_EDIT', user!, existing.id, {
        qtyCount: newQty,
        note: `+${addQty} mevcut kaleme eklendi`,
      });
      void syncMaterialStockItemToSupabase(companyId, existing.id).catch(() => {});
      return { ok: true, item: updated };
    }

    const item = store.addMaterialStock({ ...payload, companyId });
    writeAudit(companyId, 'STOCK_ADD', user!, item.id, {
      qtyCount: payload.stockQty ?? null,
      qtyMeters: payload.lengthTotal ?? payload.lengthRemaining ?? null,
      spoolId: payload.spoolId ?? null,
    });
    void syncMaterialStockItemToSupabase(companyId, item.id).catch(() => {});
    return { ok: true, item };
  },

  updateMaterialStock(
    idValue: string,
    patch: Partial<MaterialStockItem>,
    user: User | undefined
  ): { ok: true; item: MaterialStockItem } | { ok: false; error: string } {
    if (!isManager(user)) return { ok: false, error: 'materials.errors.teamLeaderCannotMutate' };
    const item = store.updateMaterialStock(idValue, patch);
    if (!item) return { ok: false, error: 'common.noData' };
    writeAudit(item.companyId, 'STOCK_EDIT', user!, item.id, {
      qtyCount: patch.stockQty ?? item.stockQty ?? null,
      qtyMeters: patch.lengthRemaining ?? patch.lengthTotal ?? item.lengthRemaining ?? item.lengthTotal ?? null,
      spoolId: item.spoolId ?? null,
    });
    void syncMaterialStockItemToSupabase(item.companyId, item.id).catch(() => {});
    return { ok: true, item };
  },

  deleteMaterialStock(companyId: string, idValue: string, user: User | undefined): { ok: true } | { ok: false; error: string } {
    if (!isManager(user)) return { ok: false, error: 'materials.errors.teamLeaderCannotMutate' };
    const list = store.getMaterialStock(companyId);
    const item = list.find((m) => m.id === idValue);
    if (item) {
      store.deleteMaterialStock(idValue);
      writeAudit(companyId, 'STOCK_DELETE', user!, idValue, {
        spoolId: item.spoolId ?? null,
      });
    } else {
      store.deleteMaterialStock(idValue);
    }
    return { ok: true };
  },

  distributeToTeam(
    companyId: string,
    params: { teamId: string; materialStockItemId: string; quantityMeters?: number; quantityPcs?: number },
    user: User | undefined
  ): { ok: true } | { ok: false; error: string } {
    if (!isManager(user)) return { ok: false, error: 'materials.errors.teamLeaderCannotMutate' };
    const stock = store.getMaterialStock(companyId);
    const item = stock.find((m) => m.id === params.materialStockItemId);
    if (!item) return { ok: false, error: 'common.noData' };
    const isMeter = isMeterType(item.mainType);
    const qty = isMeter ? (params.quantityMeters ?? 0) : (params.quantityPcs ?? 0);
    if (qty <= 0) return { ok: false, error: 'validation.positiveNumber' };
    const remaining = isMeter ? (item.lengthRemaining ?? 0) : (item.stockQty ?? 0);
    if (qty > remaining) return { ok: false, error: 'materials.distributeErrorMax' };

    if (isMeter) {
      store.updateMaterialStock(item.id, { lengthRemaining: (item.lengthRemaining ?? 0) - qty });
    } else {
      store.updateMaterialStock(item.id, { stockQty: (item.stockQty ?? 0) - qty });
    }
    const allocations = store.getTeamMaterialAllocations(companyId, params.teamId);
    const existing = allocations.find((a) => a.materialStockItemId === params.materialStockItemId);
    if (existing) {
      const updated = store.updateTeamMaterialAllocation(existing.id, {
        quantityMeters: isMeter ? (existing.quantityMeters ?? 0) + qty : undefined,
        quantityPcs: !isMeter ? (existing.quantityPcs ?? 0) + qty : undefined,
      });
      if (updated) void upsertTeamMaterialAllocationToSupabase(companyId, updated).catch(() => {});
    } else {
      const created = store.addTeamMaterialAllocation({
        companyId,
        teamId: params.teamId,
        materialStockItemId: params.materialStockItemId,
        quantityMeters: isMeter ? qty : undefined,
        quantityPcs: !isMeter ? qty : undefined,
      });
      void upsertTeamMaterialAllocationToSupabase(companyId, created).catch(() => {});
    }
    writeAudit(companyId, 'DISTRIBUTE_TO_TEAM', user!, item.id, {
      toTeamId: params.teamId,
      qtyMeters: isMeter ? qty : null,
      qtyCount: !isMeter ? qty : null,
      spoolId: item.spoolId ?? null,
    });
    const team = store.getTeam(params.teamId);
    const actor = actorFromUser(user);
    if (actor) {
      logEvent(actor, {
        action: 'MATERIAL_DISTRIBUTE_TO_TEAM',
        entity_type: 'team',
        entity_id: params.teamId,
        team_code: team?.code ?? null,
        company_id: companyId,
        meta: {
          material: { type: item.mainType, spoolId: item.spoolId ?? null },
          qtyMeters: isMeter ? qty : undefined,
          qtyPcs: !isMeter ? qty : undefined,
        },
      });
    }
    void syncMaterialStockItemToSupabase(companyId, item.id).catch(() => {});
    return { ok: true };
  },

  returnToStock(
    companyId: string,
    allocationId: string,
    quantity: { quantityMeters?: number; quantityPcs?: number },
    user: User | undefined
  ): { ok: true } | { ok: false; error: string } {
    if (!isManager(user)) return { ok: false, error: 'materials.errors.teamLeaderCannotMutate' };
    const allocations = store.getTeamMaterialAllocations(companyId);
    const alloc = allocations.find((a) => a.id === allocationId);
    if (!alloc) return { ok: false, error: 'common.noData' };
    const stock = store.getMaterialStock(companyId);
    const item = stock.find((m) => m.id === alloc.materialStockItemId);
    if (!item) return { ok: false, error: 'common.noData' };
    const isMeter = isMeterType(item.mainType);
    const maxM = alloc.quantityMeters ?? 0;
    const maxP = alloc.quantityPcs ?? 0;
    const qtyM = isMeter ? (quantity.quantityMeters ?? maxM) : 0;
    const qtyP = !isMeter ? (quantity.quantityPcs ?? maxP) : 0;
    if (isMeter && (qtyM <= 0 || qtyM > maxM)) return { ok: false, error: 'materials.errors.amountExceedsAllocation' };
    if (!isMeter && (qtyP <= 0 || qtyP > maxP)) return { ok: false, error: 'materials.errors.amountExceedsAllocation' };
    store.updateMaterialStock(item.id, {
      lengthRemaining: isMeter ? (item.lengthRemaining ?? 0) + qtyM : undefined,
      stockQty: !isMeter ? (item.stockQty ?? 0) + qtyP : undefined,
    });
    const remainingM = maxM - qtyM;
    const remainingP = maxP - qtyP;
    if (remainingM <= 0 && remainingP <= 0) {
      store.deleteTeamMaterialAllocation(allocationId);
      void deleteTeamMaterialAllocationFromSupabase(companyId, allocationId).catch(() => {});
    } else {
      const updated = store.updateTeamMaterialAllocation(allocationId, {
        quantityMeters: isMeter ? remainingM : undefined,
        quantityPcs: !isMeter ? remainingP : undefined,
      });
      if (updated) void upsertTeamMaterialAllocationToSupabase(companyId, updated).catch(() => {});
    }
    writeAudit(companyId, 'RETURN_TO_STOCK', user!, item.id, {
      fromTeamId: alloc.teamId,
      qtyMeters: isMeter ? qtyM : null,
      qtyCount: !isMeter ? qtyP : null,
      spoolId: item.spoolId ?? null,
    });
    const fromTeam = store.getTeam(alloc.teamId);
    const actor = actorFromUser(user);
    if (actor) {
      logEvent(actor, {
        action: 'MATERIAL_RETURN_TO_STOCK',
        entity_type: 'team',
        entity_id: alloc.teamId,
        team_code: fromTeam?.code ?? null,
        company_id: companyId,
        meta: {
          material: { type: item.mainType, spoolId: item.spoolId ?? null },
          qtyMeters: isMeter ? qtyM : undefined,
          qtyPcs: !isMeter ? qtyP : undefined,
        },
      });
    }
    void syncMaterialStockItemToSupabase(companyId, item.id).catch(() => {});
    return { ok: true };
  },

  transferToTeam(
    companyId: string,
    params: { allocationId: string; targetTeamId: string; quantityMeters?: number; quantityPcs?: number },
    user: User | undefined
  ): { ok: true } | { ok: false; error: string } {
    if (!isManager(user)) return { ok: false, error: 'materials.errors.teamLeaderCannotMutate' };
    const allocations = store.getTeamMaterialAllocations(companyId);
    const alloc = allocations.find((a) => a.id === params.allocationId);
    if (!alloc) return { ok: false, error: 'common.noData' };
    if (alloc.teamId === params.targetTeamId) return { ok: false, error: 'materials.errors.sameTeamTransfer' };
    const maxM = alloc.quantityMeters ?? 0;
    const maxP = alloc.quantityPcs ?? 0;
    const qtyM = params.quantityMeters ?? maxM;
    const qtyP = params.quantityPcs ?? maxP;
    const isMeter = maxM > 0;
    if (isMeter && (qtyM <= 0 || qtyM > maxM)) return { ok: false, error: 'materials.errors.amountExceedsAllocation' };
    if (!isMeter && (qtyP <= 0 || qtyP > maxP)) return { ok: false, error: 'materials.errors.amountExceedsAllocation' };
    const targetAllocs = store.getTeamMaterialAllocations(companyId, params.targetTeamId);
    const existingTarget = targetAllocs.find((a) => a.materialStockItemId === alloc.materialStockItemId);
    if (existingTarget) {
      const updatedTarget = store.updateTeamMaterialAllocation(existingTarget.id, {
        quantityMeters: isMeter ? (existingTarget.quantityMeters ?? 0) + qtyM : undefined,
        quantityPcs: !isMeter ? (existingTarget.quantityPcs ?? 0) + qtyP : undefined,
      });
      if (updatedTarget) void upsertTeamMaterialAllocationToSupabase(companyId, updatedTarget).catch(() => {});
    } else {
      const createdTarget = store.addTeamMaterialAllocation({
        companyId,
        teamId: params.targetTeamId,
        materialStockItemId: alloc.materialStockItemId,
        quantityMeters: isMeter ? qtyM : undefined,
        quantityPcs: !isMeter ? qtyP : undefined,
      });
      void upsertTeamMaterialAllocationToSupabase(companyId, createdTarget).catch(() => {});
    }
    const remainingM = maxM - qtyM;
    const remainingP = maxP - qtyP;
    if (remainingM <= 0 && remainingP <= 0) {
      store.deleteTeamMaterialAllocation(params.allocationId);
      void deleteTeamMaterialAllocationFromSupabase(companyId, params.allocationId).catch(() => {});
    } else {
      const updatedSource = store.updateTeamMaterialAllocation(params.allocationId, {
        quantityMeters: isMeter ? remainingM : undefined,
        quantityPcs: !isMeter ? remainingP : undefined,
      });
      if (updatedSource) void upsertTeamMaterialAllocationToSupabase(companyId, updatedSource).catch(() => {});
    }
    const item = store.getMaterialStock(companyId).find((m) => m.id === alloc.materialStockItemId);
    writeAudit(companyId, 'TRANSFER_BETWEEN_TEAMS', user!, alloc.materialStockItemId, {
      fromTeamId: alloc.teamId,
      toTeamId: params.targetTeamId,
      qtyMeters: isMeter ? qtyM : null,
      qtyCount: !isMeter ? qtyP : null,
      spoolId: item?.spoolId ?? null,
    });
    const fromTeam = store.getTeam(alloc.teamId);
    const toTeam = store.getTeam(params.targetTeamId);
    const actor = actorFromUser(user);
    if (actor) {
      logEvent(actor, {
        action: 'MATERIAL_TRANSFER_BETWEEN_TEAMS',
        entity_type: 'team',
        entity_id: params.allocationId,
        team_code: fromTeam?.code ?? null,
        company_id: companyId,
        meta: {
          material: { type: item?.mainType, spoolId: item?.spoolId ?? null },
          fromTeam: fromTeam?.code ?? null,
          toTeam: toTeam?.code ?? null,
          qtyMeters: isMeter ? qtyM : undefined,
          qtyPcs: !isMeter ? qtyP : undefined,
        },
      });
    }
    return { ok: true };
  },
};
