import { store } from '../data/store';
import { getApprovedJobsWithDetailsForUser } from './jobCalculationService';
import { getJobsForUser } from './jobScopeService';
import { getTeamsForUser } from './teamScopeService';
import { getActivePeriod } from '../utils/periodUtils';
import { isDateInPeriod } from '../utils/periodUtils';
import { getLocalTodayString, getLocalWeekRange, getLocalMonthString } from '../utils/localDateUtils';
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
  /** When payroll period is configured, main totals and teamSummary are for this period. */
  activePayrollPeriod?: { start: string; end: string; label?: string };
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
  activePayrollPeriod?: { start: string; end: string; label?: string };
};

export type DashboardSummary = DashboardSummaryAdmin | DashboardSummaryTL;

/** Yerel zaman dilimine göre filtreler (İsveç/Türkiye vb. cihaz saatine göre). */
function dayFilter(now: Date) {
  const today = getLocalTodayString(now);
  return (d: string) => d === today;
}

function weekFilter(now: Date) {
  const { start, end } = getLocalWeekRange(now);
  return (d: string) => d >= start && d <= end;
}

/** Takvim ayı (hakediş ayarı yoksa yedek). */
function calendarMonthFilter(now: Date) {
  const ym = getLocalMonthString(now);
  return (d: string) => d.slice(0, 7) === ym;
}

/** Aylık = hakediş dönemi (son gün 23:59'da biter, dahil). Ayar yoksa takvim ayı. */
function periodOrMonthFilter(
  now: Date,
  activePayrollPeriod: { start: string; end: string } | undefined
) {
  if (activePayrollPeriod)
    return (d: string) => isDateInPeriod(d, activePayrollPeriod);
  return calendarMonthFilter(now);
}

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
  if (!companyId || !user || !user.role) return null;

  const jobs = getJobsForUser(companyId, user);
  const pendingCount = jobs.filter((j) => j.status === 'submitted').length;
  const allApprovedWithDetails = getApprovedJobsWithDetailsForUser(companyId, user);
  const teams = getTeamsForUser(companyId, user);

  const payrollSettings = store.getPayrollPeriodSettings(companyId);
  const now = new Date();
  let approvedWithDetails = allApprovedWithDetails;
  let activePayrollPeriod: { start: string; end: string; label?: string } | undefined;
  if (payrollSettings) {
    activePayrollPeriod = getActivePeriod(now, payrollSettings.startDayOfMonth);
    approvedWithDetails = allApprovedWithDetails.filter((j) =>
      isDateInPeriod(j.date, activePayrollPeriod!)
    );
  }
  const approvedCount = approvedWithDetails.length;

  if (user.role === 'teamLeader') {
    const teamTotal = approvedWithDetails.reduce((s, j) => s + j.teamEarnings, 0);
    const daily = {
      team_total: approvedWithDetails.filter((j) => dayFilter(now)(j.date)).reduce((s, j) => s + j.teamEarnings, 0),
      count: approvedWithDetails.filter((j) => dayFilter(now)(j.date)).length,
    };
    const weekly = {
      team_total: approvedWithDetails.filter((j) => weekFilter(now)(j.date)).reduce((s, j) => s + j.teamEarnings, 0),
      count: approvedWithDetails.filter((j) => weekFilter(now)(j.date)).length,
    };
    const monthlyFilter = periodOrMonthFilter(now, activePayrollPeriod);
    const monthly = {
      team_total: approvedWithDetails.filter((j) => monthlyFilter(j.date)).reduce((s, j) => s + j.teamEarnings, 0),
      count: approvedWithDetails.filter((j) => monthlyFilter(j.date)).length,
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
      activePayrollPeriod,
    };
  }

  const daily = reducePeriod(approvedWithDetails, dayFilter(now));
  const weekly = reducePeriod(approvedWithDetails, weekFilter(now));
  const monthly = reducePeriod(approvedWithDetails, periodOrMonthFilter(now, activePayrollPeriod));
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
    activePayrollPeriod,
  };
}
