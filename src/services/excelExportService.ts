import * as XLSX from 'xlsx';
import { store } from '../data/store';
import { getJobWithDetails, getApprovedJobsWithDetailsForUser } from './jobCalculationService';
import { getJobsForUser } from './jobScopeService';
import { getTeamsForUser } from './teamScopeService';
import { formatPriceForUser } from '../utils/priceRules';
import { getLocalTodayString, getLocalWeekRange, getLocalMonthString } from '../utils/localDateUtils';
import { getActivePeriod, isDateInPeriod } from '../utils/periodUtils';
import type { Locale } from '../i18n/I18nContext';
import type { JobWithDetails } from '../types';
import type { User } from '../types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function exportJobsToExcel(companyId: string, user: User | undefined, options?: { status?: 'all' | 'approved'; locale?: Locale }) {
  const loc: Locale = options?.locale ?? 'en';
  const scopedJobs = getJobsForUser(companyId, user);
  const jobs = options?.status === 'approved'
    ? getApprovedJobsWithDetailsForUser(companyId, user)
    : scopedJobs.map((j) => getJobWithDetails(j, companyId)).filter((j): j is JobWithDetails => j != null);
  const teams = getTeamsForUser(companyId, user);
  const workItems = store.getWorkItems(companyId);
  const getTeamCode = (id: string) => teams.find((t) => t.id === id)?.code ?? id;
  const getWorkItemCode = (id: string) => workItems.find((w) => w.id === id)?.code ?? id;

  const rows = jobs.map((j) => ({
    Date: formatDate(j.date),
    Team: getTeamCode(j.teamId),
    'Work Item': getWorkItemCode(j.workItemId),
    Quantity: j.quantity,
    Status: j.status,
    'Total Work Value': j.status === 'approved' ? formatPriceForUser(j.totalWorkValue, user, 'companyOrTotal', loc) : '',
    'Team Earnings': j.status === 'approved' ? formatPriceForUser(j.teamEarnings, user, 'teamOnly', loc) : '',
    'Company Share': j.status === 'approved' ? formatPriceForUser(j.companyShare, user, 'companyOrTotal', loc) : '',
    Notes: j.notes,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jobs');
  XLSX.writeFile(wb, `jobs-export-${getLocalTodayString(new Date())}.xlsx`);
}

export function exportDashboardToExcel(companyId: string, user: User | undefined, locale: Locale = 'en') {
  const approved = getApprovedJobsWithDetailsForUser(companyId, user);
  const now = new Date();
  const todayStr = getLocalTodayString(now);
  const weekRange = getLocalWeekRange(now);
  const payrollSettings = store.getPayrollPeriodSettings(companyId);
  const inPeriodOrMonth = payrollSettings
    ? (j: { date: string }) => isDateInPeriod(j.date, getActivePeriod(now, payrollSettings.startDayOfMonth))
    : (j: { date: string }) => j.date.slice(0, 7) === getLocalMonthString(now);
  const daily = approved.filter((j) => j.date.slice(0, 10) === todayStr);
  const weekly = approved.filter((j) => j.date >= weekRange.start && j.date <= weekRange.end);
  const monthly = approved.filter(inPeriodOrMonth);

  const summary = [
    { Period: 'Daily', Count: daily.length, TotalValue: formatPriceForUser(daily.reduce((s, j) => s + j.totalWorkValue, 0), user, 'companyOrTotal', locale), TeamEarnings: formatPriceForUser(daily.reduce((s, j) => s + j.teamEarnings, 0), user, 'teamOnly', locale), CompanyShare: formatPriceForUser(daily.reduce((s, j) => s + j.companyShare, 0), user, 'companyOrTotal', locale) },
    { Period: 'Weekly', Count: weekly.length, TotalValue: formatPriceForUser(weekly.reduce((s, j) => s + j.totalWorkValue, 0), user, 'companyOrTotal', locale), TeamEarnings: formatPriceForUser(weekly.reduce((s, j) => s + j.teamEarnings, 0), user, 'teamOnly', locale), CompanyShare: formatPriceForUser(weekly.reduce((s, j) => s + j.companyShare, 0), user, 'companyOrTotal', locale) },
    { Period: 'Monthly', Count: monthly.length, TotalValue: formatPriceForUser(monthly.reduce((s, j) => s + j.totalWorkValue, 0), user, 'companyOrTotal', locale), TeamEarnings: formatPriceForUser(monthly.reduce((s, j) => s + j.teamEarnings, 0), user, 'teamOnly', locale), CompanyShare: formatPriceForUser(monthly.reduce((s, j) => s + j.companyShare, 0), user, 'companyOrTotal', locale) },
  ];

  const ws = XLSX.utils.json_to_sheet(summary);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dashboard Summary');
  XLSX.writeFile(wb, `dashboard-export-${getLocalTodayString(now)}.xlsx`);
}
