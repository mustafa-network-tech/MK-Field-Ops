import { store } from '../data/store';
import { canUserUseTeamForJob } from './teamScopeService';
import type { User } from '../types';

export type AddJobResult = { ok: true } | { ok: false; error: string };
export type UpdateJobResult = { ok: true } | { ok: false; error: string };

/**
 * Validates teamId for current user (TL = only own teams) then creates job.
 * Use this instead of store.addJob to enforce team leader scope.
 */
export function addJob(
  user: User | undefined,
  params: {
    companyId: string;
    date: string;
    teamId: string;
    workItemId: string;
    quantity: number;
    materialIds: string[];
    equipmentIds: string[];
    notes: string;
    createdBy: string;
  }
): AddJobResult {
  if (!user) return { ok: false, error: 'jobs.validation.unauthorized' };
  if (!canUserUseTeamForJob(user, params.teamId, params.companyId)) {
    return { ok: false, error: 'jobs.validation.teamNotAllowed' };
  }
  store.addJob({
    ...params,
    status: 'draft',
  });
  return { ok: true };
}

/**
 * Validates that the job's team (and patch.teamId if present) is allowed for current user, then updates.
 * Use this instead of store.updateJob to enforce team leader scope.
 */
export function updateJob(
  user: User | undefined,
  companyId: string,
  jobId: string,
  patch: { status?: string; teamId?: string; [key: string]: unknown }
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
  store.updateJob(jobId, patch);
  return { ok: true };
}
