import { store } from '../data/store';
import { getTeamJobStatsForUser } from './jobCalculationService';
import { getLocalWeekRange, getLocalMonthString } from '../utils/localDateUtils';
import { getActivePeriod, isDateInPeriod } from '../utils/periodUtils';
import type { User } from '../types';

/** Job row: admin/pm get gross, team, company; TL only team (backend never returns gross/company). */
export type TeamDetailJobRowAdmin = { id: string; date: string; workItemId: string; quantity: number; gross: number; team: number; company: number };
export type TeamDetailJobRowTL = { id: string; date: string; workItemId: string; quantity: number; team: number };

export type TeamDetailResponseAdmin = {
  role: 'companyManager' | 'projectManager';
  grossTotal: number;
  teamTotal: number;
  companyTotal: number;
  weekly: { gross: number; team: number; company: number };
  monthly: { gross: number; team: number; company: number };
  jobs: TeamDetailJobRowAdmin[];
  totalJobs: number;
  approvedCount: number;
  pendingCount: number;
};

export type TeamDetailResponseTL = {
  role: 'teamLeader';
  teamTotal: number;
  weekly: { team: number };
  monthly: { team: number };
  jobs: TeamDetailJobRowTL[];
  totalJobs: number;
  approvedCount: number;
  pendingCount: number;
};

export type TeamDetailResponse = TeamDetailResponseAdmin | TeamDetailResponseTL;

/**
 * Backend: team detail summary. Role-based response.
 * - admin/pm: grossTotal, teamTotal, companyTotal; each period and row has gross, team, company.
 * - teamLeader: only teamTotal and team in rows; gross/company never in response.
 */
export function getTeamDetailSummary(companyId: string, teamId: string, user: User | undefined): TeamDetailResponse | null {
  if (!companyId || !teamId || !user) return null;

  const stats = getTeamJobStatsForUser(companyId, teamId);
  const jobsWithDetails = stats.jobsWithDetails;

  if (user.role === 'teamLeader') {
    return {
      role: 'teamLeader',
      teamTotal: stats.totalEarnings,
      weekly: { team: stats.weeklyEarnings },
      monthly: { team: stats.monthlyEarnings },
      jobs: jobsWithDetails
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((j) => ({ id: j.id, date: j.date, workItemId: j.workItemId, quantity: j.quantity, team: j.teamEarnings })),
      totalJobs: stats.totalJobs,
      approvedCount: stats.approvedCount,
      pendingCount: stats.pendingCount,
    };
  }

  const grossTotal = jobsWithDetails.reduce((s, j) => s + j.totalWorkValue, 0);
  const teamTotal = stats.totalEarnings;
  const companyTotal = jobsWithDetails.reduce((s, j) => s + j.companyShare, 0);
  const now = new Date();
  const weekRange = getLocalWeekRange(now);
  const payrollSettings = store.getPayrollPeriodSettings(companyId);
  const inPeriodOrMonth = payrollSettings
    ? (d: string) => isDateInPeriod(d, getActivePeriod(now, payrollSettings.startDayOfMonth))
    : (d: string) => d.slice(0, 7) === getLocalMonthString(now);
  const weeklyGross = jobsWithDetails.filter((j) => j.date >= weekRange.start && j.date <= weekRange.end).reduce((s, j) => s + j.totalWorkValue, 0);
  const weeklyTeam = stats.weeklyEarnings;
  const weeklyCompany = weeklyGross - weeklyTeam;
  const monthlyGross = jobsWithDetails.filter((j) => inPeriodOrMonth(j.date)).reduce((s, j) => s + j.totalWorkValue, 0);
  const monthlyTeam = stats.monthlyEarnings;
  const monthlyCompany = monthlyGross - monthlyTeam;

  return {
    role: user.role as 'companyManager' | 'projectManager',
    grossTotal,
    teamTotal,
    companyTotal,
    weekly: { gross: weeklyGross, team: weeklyTeam, company: weeklyCompany },
    monthly: { gross: monthlyGross, team: monthlyTeam, company: monthlyCompany },
    jobs: jobsWithDetails
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((j) => ({
        id: j.id,
        date: j.date,
        workItemId: j.workItemId,
        quantity: j.quantity,
        gross: j.totalWorkValue,
        team: j.teamEarnings,
        company: j.companyShare,
      })),
    totalJobs: stats.totalJobs,
    approvedCount: stats.approvedCount,
    pendingCount: stats.pendingCount,
  };
}
