import { store } from '../data/store';
import {
  deleteTeamMaterialAllocationFromSupabase,
  upsertJob,
  upsertTeamMaterialAllocationToSupabase,
} from './supabaseSyncService';
import { canUserUseTeamForJob } from './teamScopeService';
import { roundMoney } from '../utils/formatLocale';
import { logEvent, actorFromUser } from './auditLogService';
import { addActivityNotification } from './activityNotificationService';
import { getProjectDisplayKey } from '../utils/projectKey';
import type { User, JobRecord, JobMaterialUsage, TeamMaterialAllocation } from '../types';

export type AddJobResult = { ok: true } | { ok: false; error: string };
export type UpdateJobResult = { ok: true } | { ok: false; error: string };

export const PAYROLL_PERIOD_LOCKED_ERROR = 'jobs.payrollPeriodClosed' as const;

export function normalizeJobApiError(apiError: { code?: string; message?: string } | null): string | null {
  if (!apiError) return null;
  const msg = (apiError.message ?? '').toUpperCase();
  if (apiError.code === 'PAYROLL_PERIOD_LOCKED' || msg.includes('PAYROLL_PERIOD_LOCKED')) {
    return PAYROLL_PERIOD_LOCKED_ERROR;
  }
  return null;
}

function isMeterType(mainType: string): boolean {
  return mainType === 'boru' || mainType === 'kablo_ic' || mainType === 'kablo_yeraltı' || mainType === 'kablo_havai';
}

function captureZimmetSnapshotsBeforeDeduct(companyId: string, job: JobRecord): Map<string, TeamMaterialAllocation> {
  const snaps = new Map<string, TeamMaterialAllocation>();
  const usages = job.materialUsages ?? [];
  const allAllocations = store.getTeamMaterialAllocations(companyId);
  const seen = new Set<string>();

  for (const u of usages) {
    if (u.isExternal) continue;
    let allocId: string | null = null;
    if (u.teamZimmetId) {
      const alloc = allAllocations.find((a) => a.id === u.teamZimmetId);
      if (alloc && alloc.teamId === job.teamId) allocId = alloc.id;
    } else if (u.materialStockItemId) {
      const alloc = allAllocations.find(
        (a) => a.teamId === job.teamId && a.materialStockItemId === u.materialStockItemId
      );
      allocId = alloc?.id ?? null;
    }
    if (allocId && !seen.has(allocId)) {
      seen.add(allocId);
      const alloc = allAllocations.find((a) => a.id === allocId);
      if (alloc) snaps.set(allocId, { ...alloc });
    }
  }
  return snaps;
}

function tryDeductZimmetForApprovedJob(
  companyId: string,
  job: JobRecord
): { ok: true } | { ok: false; error: string } {
  if (job.stockDeducted) return { ok: true };
  const usages = job.materialUsages ?? [];
  const allAllocations = store.getTeamMaterialAllocations(companyId);
  const stock = store.getMaterialStock(companyId);

  const deletedAllocIds = new Set<string>();
  const updatedAllocIds = new Set<string>();

  type Agg = { quantityM: number; quantityPcs: number };
  const byZimmetId = new Map<string, Agg>();

  for (const u of usages) {
    if (u.isExternal) continue;
    let allocId: string | null = null;
    if (u.teamZimmetId) {
      const alloc = allAllocations.find((a) => a.id === u.teamZimmetId);
      if (!alloc || alloc.teamId !== job.teamId) return { ok: false, error: 'jobs.approvalFailedInsufficientZimmet' };
      const item = stock.find((m) => m.id === alloc.materialStockItemId);
      if (!item) return { ok: false, error: 'jobs.approvalFailedInsufficientZimmet' };
      allocId = alloc.id;
    } else if (u.materialStockItemId) {
      const alloc = allAllocations.find(
        (a) => a.teamId === job.teamId && a.materialStockItemId === u.materialStockItemId
      );
      if (!alloc) return { ok: false, error: 'jobs.approvalFailedInsufficientZimmet' };
      const item = stock.find((m) => m.id === alloc.materialStockItemId);
      if (!item) return { ok: false, error: 'jobs.approvalFailedInsufficientZimmet' };
      allocId = alloc.id;
    } else continue;

    if (!byZimmetId.has(allocId)) byZimmetId.set(allocId, { quantityM: 0, quantityPcs: 0 });
    const agg = byZimmetId.get(allocId)!;
    if (u.quantityUnit === 'm') agg.quantityM += u.quantity;
    else agg.quantityPcs += u.quantity;
  }

  for (const [allocId, agg] of byZimmetId) {
    const alloc = allAllocations.find((a) => a.id === allocId);
    if (!alloc) return { ok: false, error: 'jobs.approvalFailedInsufficientZimmet' };
    const item = stock.find((m) => m.id === alloc.materialStockItemId);
    if (!item) return { ok: false, error: 'jobs.approvalFailedInsufficientZimmet' };
    const isCable = isMeterType(item.mainType);
    if (isCable) {
      if ((alloc.quantityMeters ?? 0) < agg.quantityM) return { ok: false, error: 'jobs.approvalFailedInsufficientZimmet' };
    } else {
      if ((alloc.quantityPcs ?? 0) < agg.quantityPcs) return { ok: false, error: 'jobs.approvalFailedInsufficientZimmet' };
    }
  }

  for (const [allocId, agg] of byZimmetId) {
    const alloc = allAllocations.find((a) => a.id === allocId);
    if (!alloc) continue;
    const item = stock.find((m) => m.id === alloc.materialStockItemId);
    if (!item) continue;
    const isCable = isMeterType(item.mainType);
    if (isCable) {
      const remaining = (alloc.quantityMeters ?? 0) - agg.quantityM;
      if (remaining <= 0) {
        store.deleteTeamMaterialAllocation(allocId);
        deletedAllocIds.add(allocId);
      } else {
        store.updateTeamMaterialAllocation(allocId, { quantityMeters: remaining });
        updatedAllocIds.add(allocId);
      }
    } else {
      const remaining = (alloc.quantityPcs ?? 0) - agg.quantityPcs;
      if (remaining <= 0) {
        store.deleteTeamMaterialAllocation(allocId);
        deletedAllocIds.add(allocId);
      } else {
        store.updateTeamMaterialAllocation(allocId, { quantityPcs: remaining });
        updatedAllocIds.add(allocId);
      }
    }
  }

  if (deletedAllocIds.size) {
    for (const allocationId of deletedAllocIds) {
      void deleteTeamMaterialAllocationFromSupabase(companyId, allocationId).catch(() => {});
    }
  }
  if (updatedAllocIds.size) {
    const freshAllocs = store.getTeamMaterialAllocations(companyId);
    const allocMap = new Map(freshAllocs.map((a) => [a.id, a]));
    for (const allocationId of updatedAllocIds) {
      const alloc = allocMap.get(allocationId);
      if (alloc) void upsertTeamMaterialAllocationToSupabase(companyId, alloc).catch(() => {});
    }
  }

  return { ok: true };
}

function cloudSaveErrorKey(syncError: string | undefined): string {
  return normalizeJobApiError({ message: syncError ?? '' }) ?? 'jobs.cloudSaveFailed';
}

export async function addJob(
  user: User | undefined,
  params: {
    companyId: string;
    date: string;
    projectId: string;
    teamId: string;
    workItemId: string;
    quantity: number;
    materialIds: string[];
    materialUsages?: JobMaterialUsage[];
    equipmentIds: string[];
    notes: string;
    notePhotos?: string[] | null;
    createdBy: string;
  }
): Promise<AddJobResult> {
  if (!user) return { ok: false, error: 'jobs.validation.unauthorized' };
  const project = store.getProject(params.projectId, params.companyId);
  if (!project || project.status !== 'ACTIVE') {
    return { ok: false, error: 'projects.projectNotFound' };
  }
  if (!canUserUseTeamForJob(user, params.teamId, params.companyId)) {
    return { ok: false, error: 'jobs.validation.teamNotAllowed' };
  }
  const newJob = store.addJob({
    ...params,
    quantity: roundMoney(params.quantity),
    materialUsages: params.materialUsages ?? [],
    notePhotos: (params.notePhotos?.length ? params.notePhotos : []).slice(0, 3),
    status: 'draft',
  });

  const { supabase } = await import('./supabaseClient');
  if (supabase) {
    const sync = await upsertJob(newJob);
    if (!sync.ok) {
      store.deleteJob(newJob.id);
      return { ok: false, error: cloudSaveErrorKey(sync.error) };
    }
  }

  const team = store.getTeam(params.teamId);
  const actor = actorFromUser(user);
  if (actor) {
    logEvent(actor, {
      action: 'JOB_CREATED',
      entity_type: 'job',
      entity_id: newJob.id,
      team_code: team?.code ?? null,
      project_id: params.projectId ?? null,
      company_id: params.companyId,
      meta: { date: newJob.date, workItemId: newJob.workItemId, quantity: newJob.quantity },
    });
  }
  return { ok: true };
}

async function persistJobToCloud(job: JobRecord): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await import('./supabaseClient');
  if (!supabase) return { ok: true };
  return upsertJob(job);
}

export async function updateJob(
  user: User | undefined,
  companyId: string,
  jobId: string,
  patch: Partial<JobRecord>
): Promise<UpdateJobResult> {
  if (!user) return { ok: false, error: 'jobs.validation.unauthorized' };
  const job = store.getJobs(companyId).find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'jobs.validation.jobNotFound' };
  if (!canUserUseTeamForJob(user, job.teamId, companyId)) {
    return { ok: false, error: 'jobs.validation.teamNotAllowed' };
  }
  if (patch.teamId !== undefined && patch.teamId !== job.teamId) {
    if (!canUserUseTeamForJob(user, patch.teamId, companyId)) {
      return { ok: false, error: 'jobs.validation.teamNotAllowed' };
    }
  }

  const now = new Date().toISOString();
  const jobPatch: Partial<JobRecord> =
    patch.status !== undefined
      ? { ...patch, status: patch.status as JobRecord['status'] }
      : patch;

  const emitAudit = () => {
    const actor = actorFromUser(user);
    const team = store.getTeam(job.teamId);
    if (actor) {
      const action =
        patch.status === 'submitted'
          ? 'JOB_SUBMITTED'
          : patch.status === 'approved'
            ? 'JOB_APPROVED'
            : patch.status === 'rejected'
              ? 'JOB_REJECTED'
              : 'JOB_UPDATED';
      logEvent(actor, {
        action,
        entity_type: 'job',
        entity_id: jobId,
        team_code: team?.code ?? null,
        project_id: job.projectId ?? null,
        company_id: companyId,
        meta: patch.status ? { previousStatus: job.status, newStatus: patch.status } : {},
      });
    }
    if (patch.status === 'approved' && user.role === 'projectManager') {
      const project = job.projectId ? store.getProject(job.projectId, companyId) : undefined;
      const projectKey = project ? getProjectDisplayKey(project) : '–';
      addActivityNotification({
        companyId,
        type: 'pm_job_approved',
        titleKey: 'notifications.pmJobApproved',
        meta: {
          actorName: user.fullName ?? '–',
          teamCode: team?.code ?? '–',
          projectKey,
        },
      });
    }
  };

  if (patch.status === 'submitted') {
    const merged = { ...job, ...patch, status: 'submitted' as const, updatedAt: now };
    const sync = await persistJobToCloud(merged);
    if (!sync.ok) return { ok: false, error: cloudSaveErrorKey(sync.error) };
    const updated = store.updateJob(jobId, patch);
    if (!updated) return { ok: false, error: 'jobs.validation.jobNotFound' };
    emitAudit();
    return { ok: true };
  }

  if (patch.status === 'rejected') {
    const merged = { ...job, ...patch, status: 'rejected' as const, updatedAt: now };
    const sync = await persistJobToCloud(merged);
    if (!sync.ok) return { ok: false, error: cloudSaveErrorKey(sync.error) };
    store.updateJob(jobId, patch);
    emitAudit();
    return { ok: true };
  }

  const isApproval = patch.status === 'approved';
  const wouldBe = { ...job, ...patch } as JobRecord;
  const hasZimmetUsages =
    (wouldBe.materialUsages?.length ?? 0) > 0 &&
    wouldBe.materialUsages!.some((u) => !u.isExternal && (u.teamZimmetId || u.materialStockItemId));

  if (isApproval) {
    let snapshots = new Map<string, TeamMaterialAllocation>();
    let updated: JobRecord | undefined;

    if (!wouldBe.stockDeducted && hasZimmetUsages) {
      snapshots = captureZimmetSnapshotsBeforeDeduct(companyId, wouldBe);
      const deductResult = tryDeductZimmetForApprovedJob(companyId, wouldBe);
      if (!deductResult.ok) return deductResult;
      updated = store.updateJob(jobId, { ...jobPatch, stockDeducted: true });
    } else {
      updated = store.updateJob(jobId, jobPatch);
    }

    if (!updated) return { ok: false, error: 'jobs.validation.jobNotFound' };

    const sync = await persistJobToCloud(updated);
    if (!sync.ok) {
      if (snapshots.size > 0) {
        for (const snap of snapshots.values()) {
          store.replaceTeamMaterialAllocation(snap);
          void upsertTeamMaterialAllocationToSupabase(companyId, snap).catch(() => {});
        }
      }
      store.updateJob(jobId, {
        status: job.status,
        stockDeducted: job.stockDeducted,
        approvedBy: job.approvedBy,
        approvedAt: job.approvedAt,
      });
      return { ok: false, error: cloudSaveErrorKey(sync.error) };
    }
    emitAudit();
    return { ok: true };
  }

  const updated = store.updateJob(jobId, jobPatch);
  if (updated) {
    const sync = await persistJobToCloud(updated);
    if (!sync.ok) return { ok: false, error: cloudSaveErrorKey(sync.error) };
  }
  emitAudit();
  return { ok: true };
}
