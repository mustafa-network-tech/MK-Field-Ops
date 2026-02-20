import { getApprovedJobsWithDetailsForUser } from './jobCalculationService';
import { getJobsForUser } from './jobScopeService';
import { getTeamsForUser } from './teamScopeService';
import type { User } from '../types';
import type { JobWithDetails } from '../types';

/** Period totals: admin/pm see all three, TL response never includes gross_total or company_total. */
export type PeriodTotalsAdmin = { gross_total: number; team_total: number; company_total: number; count: number };
export type PeriodTotalsTL = { team_total: number; count: number };

/** Team summary row: admin/pm see gross, team, company; TL only team. */
export type TeamSummaryRowAdmin = { code: string; gross: number; team: number; company: number; count: number };
export type TeamSummaryRowTL = { code: string; team: number; count: number };

export type DashboardSummaryAdmin = {
  role: 'companyManager' | 'projectManager';
  grossTotal: number;
  teamTotal: number;
  companyTotal: number;
  daily: PeriodTotalsAdmin;
  weekly: PeriodTotalsAdmin;
  monthly: PeriodTotalsAdmin;
  pendingCount: number;
  approvedCount: number;
  teamSummary: TeamSummaryRowAdmin[];
};

export type DashboardSummaryTL = {
  role: 'teamLeader';
  teamTotal: number;
  daily: PeriodTotalsTL;
  weekly: PeriodTotalsTL;
  monthly: PeriodTotalsTL;
  pendingCount: number;
  approvedCount: number;
  teamSummary: TeamSummaryRowTL[];
};

export type DashboardSummary = DashboardSummaryAdmin | DashboardSummaryTL;

const now = new Date();
const dayFilter = (d: string) => d.slice(0, 10) === now.toISOString().slice(0, 10);
const weekStart = new Date(now);
weekStart.setDate(weekStart.getDate() - weekStart.getDay());
const weekEnd = new Date(weekStart);
weekEnd.setDate(weekEnd.getDate() + 7);
const weekFilter = (d: string) => {
  const j = new Date(d);
  return j >= weekStart && j < weekEnd;
};
const monthFilter = (d: string) => d.slice(0, 7) === now.toISOString().slice(0, 7);

function reducePeriod(jobs: JobWithDetails[], filter: (d: string) => boolean): PeriodTotalsAdmin {
  const filtered = jobs.filter((j) => filter(j.date));
  return {
    gross_total: filtered.reduce((s, j) => s + j.totalWorkValue, 0),
    team_total: filtered.reduce((s, j) => s + j.teamEarnings, 0),
    company_total: filtered.reduce((s, j) => s + j.companyShare, 0),
    count: filtered.length,
  };
}

/**
 * Backend: dashboard summary. Role-based response.
 * - admin/pm: gross_total, team_total, company_total in every period and team row; companyTotal.
 * - teamLeader: only team_total; no gross/company in response at all.
 */
export function getDashboardSummary(companyId: string, user: User | undefined): DashboardSummary | null {
  if (!companyId || !user) return null;

  const jobs = getJobsForUser(companyId, user);
  const pendingCount = jobs.filter((j) => j.status === 'submitted').length;
  const approvedCount = jobs.filter((j) => j.status === 'approved').length;
  const approvedWithDetails = getApprovedJobsWithDetailsForUser(companyId, user);
  const teams = getTeamsForUser(companyId, user);

  if (user.role === 'teamLeader') {
    const teamTotal = approvedWithDetails.reduce((s, j) => s + j.teamEarnings, 0);
    const daily = {
      team_total: approvedWithDetails.filter((j) => dayFilter(j.date)).reduce((s, j) => s + j.teamEarnings, 0),
      count: approvedWithDetails.filter((j) => dayFilter(j.date)).length,
    };
    const weekly = {
      team_total: approvedWithDetails.filter((j) => weekFilter(j.date)).reduce((s, j) => s + j.teamEarnings, 0),
      count: approvedWithDetails.filter((j) => weekFilter(j.date)).length,
    };
    const monthly = {
      team_total: approvedWithDetails.filter((j) => monthFilter(j.date)).reduce((s, j) => s + j.teamEarnings, 0),
      count: approvedWithDetails.filter((j) => monthFilter(j.date)).length,
    };
    const teamSummary: TeamSummaryRowTL[] = [];
    const acc: Record<string, { team: number; count: number }> = {};
    for (const j of approvedWithDetails) {
      const team = teams.find((t) => t.id === j.teamId);
      const code = team?.code ?? j.teamId;
      if (!acc[code]) acc[code] = { team: 0, count: 0 };
      acc[code].team += j.teamEarnings;
      acc[code].count += 1;
    }
    for (const [code, v] of Object.entries(acc)) {
      teamSummary.push({ code, team: v.team, count: v.count });
    }
    return {
      role: 'teamLeader',
      teamTotal,
      daily,
      weekly,
      monthly,
      pendingCount,
      approvedCount,
      teamSummary,
    };
  }

  const daily = reducePeriod(approvedWithDetails, dayFilter);
  const weekly = reducePeriod(approvedWithDetails, weekFilter);
  const monthly = reducePeriod(approvedWithDetails, monthFilter);
  const grossTotal = approvedWithDetails.reduce((s, j) => s + j.totalWorkValue, 0);
  const teamTotal = approvedWithDetails.reduce((s, j) => s + j.teamEarnings, 0);
  const companyTotal = approvedWithDetails.reduce((s, j) => s + j.companyShare, 0);
  const teamSummaryAdmin: TeamSummaryRowAdmin[] = [];
  const accAdmin: Record<string, { gross: number; team: number; company: number; count: number }> = {};
  for (const j of approvedWithDetails) {
    const team = teams.find((t) => t.id === j.teamId);
    const code = team?.code ?? j.teamId;
    if (!accAdmin[code]) accAdmin[code] = { gross: 0, team: 0, company: 0, count: 0 };
    accAdmin[code].gross += j.totalWorkValue;
    accAdmin[code].team += j.teamEarnings;
    accAdmin[code].company += j.companyShare;
    accAdmin[code].count += 1;
  }
  for (const [code, v] of Object.entries(accAdmin)) {
    teamSummaryAdmin.push({ code, gross: v.gross, team: v.team, company: v.company, count: v.count });
  }

  return {
    role: user.role as 'companyManager' | 'projectManager',
    grossTotal,
    teamTotal,
    companyTotal,
    daily,
    weekly,
    monthly,
    pendingCount,
    approvedCount,
    teamSummary: teamSummaryAdmin,
  };
}
