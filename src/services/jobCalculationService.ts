import { store } from '../data/store';
import { getTeamIdsForUser } from './teamScopeService';
import type { JobRecord, JobWithDetails } from '../types';
import type { User } from '../types';

export function computeJobFinancials(
  job: JobRecord,
  teamPercentage: number,
  workItemUnitPrice: number
): { totalWorkValue: number; teamEarnings: number; companyShare: number } {
  const totalWorkValue = job.quantity * workItemUnitPrice;
  const teamEarnings = totalWorkValue * (teamPercentage / 100);
  const companyShare = totalWorkValue - teamEarnings;
  return { totalWorkValue, teamEarnings, companyShare };
}

export function getJobWithDetails(job: JobRecord, companyId: string): JobWithDetails | null {
  const team = store.getTeams(companyId).find((t) => t.id === job.teamId);
  const workItem = store.getWorkItems(companyId).find((w) => w.id === job.workItemId);
  if (!team || !workItem) return null;
  const { totalWorkValue, teamEarnings, companyShare } = computeJobFinancials(
    job,
    team.percentage,
    workItem.unitPrice
  );
  return {
    ...job,
    totalWorkValue,
    teamEarnings,
    companyShare,
    teamPercentage: team.percentage,
  };
}

export function getApprovedJobsWithDetails(companyId: string): JobWithDetails[] {
  const jobs = store.getJobs(companyId).filter((j) => j.status === 'approved');
  return jobs
    .map((j) => getJobWithDetails(j, companyId))
    .filter((j): j is JobWithDetails => j != null);
}

/** Scope by user: TL only their teams' jobs, CM/PM all in company. */
export function getApprovedJobsWithDetailsForUser(companyId: string, user: User | undefined): JobWithDetails[] {
  if (!user) return [];
  const allowedTeamIds = getTeamIdsForUser(companyId, user);
  const jobs = store.getJobs(companyId).filter((j) => j.status === 'approved' && allowedTeamIds.includes(j.teamId));
  return jobs
    .map((j) => getJobWithDetails(j, companyId))
    .filter((j): j is JobWithDetails => j != null);
}

export function getTotalsByPeriod(
  companyId: string,
  period: 'day' | 'week' | 'month'
): { totalWorkValue: number; teamEarnings: number; companyShare: number; count: number } {
  const jobs = getApprovedJobsWithDetails(companyId);
  return reduceByPeriod(jobs, period);
}

/** Scope by user for dashboard/totals. */
export function getTotalsByPeriodForUser(
  companyId: string,
  period: 'day' | 'week' | 'month',
  user: User | undefined
): { totalWorkValue: number; teamEarnings: number; companyShare: number; count: number } {
  const jobs = getApprovedJobsWithDetailsForUser(companyId, user);
  return reduceByPeriod(jobs, period);
}

function reduceByPeriod(
  jobs: JobWithDetails[],
  period: 'day' | 'week' | 'month'
): { totalWorkValue: number; teamEarnings: number; companyShare: number; count: number } {
  const now = new Date();
  const filter =
    period === 'day'
      ? (d: string) => d.slice(0, 10) === now.toISOString().slice(0, 10)
      : period === 'week'
        ? (d: string) => {
            const j = new Date(d);
            const start = new Date(now);
            start.setDate(start.getDate() - start.getDay());
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            return j >= start && j < end;
          }
        : (d: string) => d.slice(0, 7) === now.toISOString().slice(0, 7);
  const filtered = jobs.filter((j) => filter(j.date));
  return {
    totalWorkValue: filtered.reduce((s, j) => s + j.totalWorkValue, 0),
    teamEarnings: filtered.reduce((s, j) => s + j.teamEarnings, 0),
    companyShare: filtered.reduce((s, j) => s + j.companyShare, 0),
    count: filtered.length,
  };
}

export function getTeamJobStats(companyId: string, teamId: string) {
  const jobs = store.getJobs(companyId).filter((j) => j.teamId === teamId);
  return computeTeamJobStats(companyId, jobs);
}

/**
 * Team job stats only if team is in user scope. Call getTeamForUser first.
 * Returns stats for the given team (no extra scope check here).
 */
export function getTeamJobStatsForUser(companyId: string, teamId: string): ReturnType<typeof getTeamJobStats> {
  const jobs = store.getJobs(companyId).filter((j) => j.teamId === teamId);
  return computeTeamJobStats(companyId, jobs);
}

function computeTeamJobStats(companyId: string, jobs: JobRecord[]) {
  const approved = jobs.filter((j) => j.status === 'approved');
  const pending = jobs.filter((j) => j.status === 'submitted');
  const withDetails = approved
    .map((j) => getJobWithDetails(j, companyId))
    .filter((j): j is JobWithDetails => j != null);
  const totalEarnings = withDetails.reduce((s, j) => s + j.teamEarnings, 0);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const inWeek = (d: string) => {
    const j = new Date(d);
    return j >= weekStart && j < weekEnd;
  };
  const inMonth = (d: string) => d.slice(0, 7) === now.toISOString().slice(0, 7);
  const weekly = withDetails.filter((j) => inWeek(j.date)).reduce((s, j) => s + j.teamEarnings, 0);
  const monthly = withDetails.filter((j) => inMonth(j.date)).reduce((s, j) => s + j.teamEarnings, 0);
  return {
    totalEarnings,
    totalJobs: jobs.length,
    approvedCount: approved.length,
    pendingCount: pending.length,
    weeklyEarnings: weekly,
    monthlyEarnings: monthly,
    jobsWithDetails: withDetails,
  };
}
