import { store } from '../data/store';
import { getJobWithDetails } from './jobCalculationService';
import type { JobWithDetails } from '../types';
import type { PayrollPeriod } from '../utils/periodUtils';
import { isDateInPeriod, getActivePeriod, listPeriods } from '../utils/periodUtils';

export type PayrollPeriodOption = PayrollPeriod & { isActive?: boolean };

/**
 * Single source of truth for payroll period list.
 * Returns periods sorted by period_start DESC (newest at top).
 * Active period (containing today) is first and marked with isActive: true.
 * Default selection in UI should be index 0 (active or latest completed).
 */
export function getPayrollPeriods(companyId: string): PayrollPeriodOption[] {
  const settings = store.getPayrollPeriodSettings(companyId);
  if (!settings) return [];

  const now = new Date();
  const active = getActivePeriod(now, settings.startDayOfMonth);
  const pastCount = 24;
  const raw = listPeriods(settings.startDayOfMonth, now, pastCount);

  const withActiveFlag: PayrollPeriodOption[] = raw.map((p) => {
    const isActive = p.start === active.start && p.end === active.end;
    return { ...p, isActive };
  });

  const sorted = [...withActiveFlag].sort((a, b) => (b.start > a.start ? 1 : b.start < a.start ? -1 : 0));
  return sorted;
}

export type PayrollPeriodCompanyTotals = {
  totalWorkValue: number;
  companyShare: number;
  teamShare: number;
  approvedJobsCount: number;
};

export type PayrollPeriodTeamRow = {
  teamId: string;
  teamCode: string;
  totalWorkValue: number;
  companyShare: number;
  teamShare: number;
  approvedJobsCount: number;
};

export type PayrollPeriodSummary = {
  period: PayrollPeriod;
  company: PayrollPeriodCompanyTotals;
  teams: PayrollPeriodTeamRow[];
};

/**
 * Only fully approved jobs (status === 'approved') count.
 * Returns company totals and per-team breakdown for the given period.
 */
export function getPayrollPeriodSummary(
  companyId: string,
  period: PayrollPeriod
): PayrollPeriodSummary {
  const jobs = store.getJobs(companyId).filter((j) => j.status === 'approved');
  const inPeriod = jobs.filter((j) => isDateInPeriod(j.date, period));
  const withDetails: JobWithDetails[] = inPeriod
    .map((j) => getJobWithDetails(j, companyId))
    .filter((j): j is JobWithDetails => j != null);

  const company: PayrollPeriodCompanyTotals = {
    totalWorkValue: withDetails.reduce((s, j) => s + j.totalWorkValue, 0),
    companyShare: withDetails.reduce((s, j) => s + j.companyShare, 0),
    teamShare: withDetails.reduce((s, j) => s + j.teamEarnings, 0),
    approvedJobsCount: withDetails.length,
  };

  const teamsMap = new Map<string, PayrollPeriodTeamRow>();
  const teamList = store.getTeams(companyId);

  for (const j of withDetails) {
    const team = teamList.find((t) => t.id === j.teamId);
    const code = team?.code ?? j.teamId;
    const existing = teamsMap.get(j.teamId);
    if (existing) {
      existing.totalWorkValue += j.totalWorkValue;
      existing.companyShare += j.companyShare;
      existing.teamShare += j.teamEarnings;
      existing.approvedJobsCount += 1;
    } else {
      teamsMap.set(j.teamId, {
        teamId: j.teamId,
        teamCode: code,
        totalWorkValue: j.totalWorkValue,
        companyShare: j.companyShare,
        teamShare: j.teamEarnings,
        approvedJobsCount: 1,
      });
    }
  }

  const teams = Array.from(teamsMap.values()).sort((a, b) =>
    a.teamCode.localeCompare(b.teamCode)
  );

  return { period, company, teams };
}
