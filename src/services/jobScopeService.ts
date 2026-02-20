import { store } from '../data/store';
import { getTeamIdsForUser } from './teamScopeService';
import type { User } from '../types';
import type { JobRecord } from '../types';

/**
 * Backend: jobs in scope for user. Company filter first (tenant isolation), then role scope.
 * - Team Leader: only jobs where job.teamId is in teams they lead
 * - Project Manager / Company Manager: all jobs in company
 */
export function getJobsForUser(companyId: string, user: User | undefined): JobRecord[] {
  if (!companyId || !user) return [];
  const all = store.getJobs(companyId);
  const allowedTeamIds = getTeamIdsForUser(companyId, user);
  if (user.role === 'teamLeader') {
    return all.filter((j) => allowedTeamIds.includes(j.teamId));
  }
  return all;
}

/**
 * Backend: get job only if in user scope. Company first, then role scope.
 * Returns 404 if not found, 403 if out of scope.
 */
export function getJobForUser(
  companyId: string,
  jobId: string,
  user: User | undefined
): { ok: true; job: JobRecord } | { ok: false; statusCode: 403 | 404 } {
  if (!user || !companyId || !jobId) return { ok: false, statusCode: 404 };
  const job = store.getJobs(companyId).find((j) => j.id === jobId);
  if (!job) return { ok: false, statusCode: 404 };
  if (job.companyId !== companyId) return { ok: false, statusCode: 403 };
  const allowedTeamIds = getTeamIdsForUser(companyId, user);
  if (user.role === 'teamLeader' && !allowedTeamIds.includes(job.teamId)) {
    return { ok: false, statusCode: 403 };
  }
  return { ok: true, job };
}
