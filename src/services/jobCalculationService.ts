import { store } from '../data/store';
import { getTeamIdsForUser } from './teamScopeService';
import { getLocalTodayString, getLocalWeekRange, getLocalMonthString } from '../utils/localDateUtils';
import { getActivePeriod, isDateInPeriod } from '../utils/periodUtils';
import { roundMoney } from '../utils/formatLocale';
import type { JobRecord, JobWithDetails } from '../types';
import type { User } from '../types';

export function computeJobFinancials(
  job: JobRecord,
  teamPercentage: number,
  workItemUnitPrice: number
): { totalWorkValue: number; teamEarnings: number; companyShare: number } {
  const totalWorkValue = roundMoney(job.quantity * workItemUnitPrice);
  const teamEarnings = roundMoney(totalWorkValue * (teamPercentage / 100));
  const companyShare = roundMoney(totalWorkValue - teamEarnings);
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
    unitPrice: workItem.unitPrice,
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
  return reduceByPeriod(jobs, period, companyId);
}

/** Scope by user for dashboard/totals. */
export function getTotalsByPeriodForUser(
  companyId: string,
  period: 'day' | 'week' | 'month',
  user: User | undefined
): { totalWorkValue: number; teamEarnings: number; companyShare: number; count: number } {
  const jobs = getApprovedJobsWithDetailsForUser(companyId, user);
  return reduceByPeriod(jobs, period, companyId);
}

/** Gün/hafta yerel; ay = hakediş dönemi (varsa), yoksa takvim ayı. */
function reduceByPeriod(
  jobs: JobWithDetails[],
  period: 'day' | 'week' | 'month',
  companyId: string
): { totalWorkValue: number; teamEarnings: number; companyShare: number; count: number } {
  const now = new Date();
  const todayStr = getLocalTodayString(now);
  const weekRange = getLocalWeekRange(now);
  let filter: (d: string) => boolean;
  if (period === 'day') {
    filter = (d) => d === todayStr;
  } else if (period === 'week') {
    filter = (d) => d >= weekRange.start && d <= weekRange.end;
  } else {
    const settings = store.getPayrollPeriodSettings(companyId);
    if (settings) {
      const periodRange = getActivePeriod(now, settings.startDayOfMonth);
      filter = (d) => isDateInPeriod(d, periodRange);
    } else {
      const monthStr = getLocalMonthString(now);
      filter = (d) => d.slice(0, 7) === monthStr;
    }
  }
  const filtered = jobs.filter((j) => filter(j.date));
  return {
    totalWorkValue: roundMoney(filtered.reduce((s, j) => s + j.totalWorkValue, 0)),
    teamEarnings: roundMoney(filtered.reduce((s, j) => s + j.teamEarnings, 0)),
    companyShare: roundMoney(filtered.reduce((s, j) => s + j.companyShare, 0)),
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
  const weekRange = getLocalWeekRange(now);
  const inWeek = (d: string) => d >= weekRange.start && d <= weekRange.end;
  const settings = store.getPayrollPeriodSettings(companyId);
  const inPeriodOrMonth = settings
    ? (d: string) => isDateInPeriod(d, getActivePeriod(now, settings.startDayOfMonth))
    : (d: string) => d.slice(0, 7) === getLocalMonthString(now);
  const weekly = withDetails.filter((j) => inWeek(j.date)).reduce((s, j) => s + j.teamEarnings, 0);
  const monthly = withDetails.filter((j) => inPeriodOrMonth(j.date)).reduce((s, j) => s + j.teamEarnings, 0);
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
