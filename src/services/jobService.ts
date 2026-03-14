import { store } from '../data/store';
import { canUserUseTeamForJob } from './teamScopeService';
import { roundMoney } from '../utils/formatLocale';
import { logEvent, actorFromUser } from './auditLogService';
import { addActivityNotification } from './activityNotificationService';
import { getProjectDisplayKey } from '../utils/projectKey';
import type { User, JobRecord, JobMaterialUsage } from '../types';

export type AddJobResult = { ok: true } | { ok: false; error: string };
export type UpdateJobResult = { ok: true } | { ok: false; error: string };

/** When DB/API raises PAYROLL_PERIOD_LOCKED, use this i18n key for the user message. */
export const PAYROLL_PERIOD_LOCKED_ERROR = 'jobs.payrollPeriodClosed' as const;

/**
 * Map API/DB error to app error key. Use when integrating Supabase (or any backend) for jobs.
 * Example: const { error } = await supabase.from('jobs').insert(...);
 *          if (error) return { ok: false, error: normalizeJobApiError(error) ?? error.message };
 */
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

/**
 * Validates and deducts from team ZIMMET (assignments) when job is FINAL APPROVED.
 * Only usages with teamZimmetId (or legacy materialStockItemId) are deducted.
 * Idempotent: only runs when job.stockDeducted is false.
 * Returns error if insufficient zimmet; then no deduction and approval is aborted.
 */
function tryDeductZimmetForApprovedJob(
  companyId: string,
  job: JobRecord
): { ok: true } | { ok: false; error: string } {
  if (job.stockDeducted) return { ok: true };
  const usages = job.materialUsages ?? [];
  const allAllocations = store.getTeamMaterialAllocations(companyId);
  const stock = store.getMaterialStock(companyId);

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
      if (remaining <= 0) store.deleteTeamMaterialAllocation(allocId);
      else store.updateTeamMaterialAllocation(allocId, { quantityMeters: remaining });
    } else {
      const remaining = (alloc.quantityPcs ?? 0) - agg.quantityPcs;
      if (remaining <= 0) store.deleteTeamMaterialAllocation(allocId);
      else store.updateTeamMaterialAllocation(allocId, { quantityPcs: remaining });
    }
  }

  return { ok: true };
}

/**
 * Validates teamId for current user (TL = only own teams) then creates job.
 * Use this instead of store.addJob to enforce team leader scope.
 */
export function addJob(
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
    createdBy: string;
  }
): AddJobResult {
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
    status: 'draft',
  });
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

/**
 * Validates that the job's team (and patch.teamId if present) is allowed for current user, then updates.
 * When status becomes 'approved', deducts from team ZIMMET first; if insufficient, approval is aborted.
 * Deduction runs only once per job (stockDeducted flag). Use this instead of store.updateJob.
 */
export function updateJob(
  user: User | undefined,
  companyId: string,
  jobId: string,
  patch: Partial<JobRecord>
): UpdateJobResult {
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

  const isApproval = patch.status === 'approved';
  const wouldBe = { ...job, ...patch } as JobRecord;
  const hasZimmetUsages =
    (wouldBe.materialUsages?.length ?? 0) > 0 &&
    wouldBe.materialUsages!.some((u) => !u.isExternal && (u.teamZimmetId || u.materialStockItemId));

  const jobPatch: Partial<JobRecord> =
    patch.status !== undefined
      ? { ...patch, status: patch.status as JobRecord['status'] }
      : patch;

  if (isApproval && !wouldBe.stockDeducted && hasZimmetUsages) {
    const deductResult = tryDeductZimmetForApprovedJob(companyId, wouldBe);
    if (!deductResult.ok) return deductResult;
    store.updateJob(jobId, { ...jobPatch, stockDeducted: true });
  } else {
    store.updateJob(jobId, jobPatch);
  }

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
  return { ok: true };
}
