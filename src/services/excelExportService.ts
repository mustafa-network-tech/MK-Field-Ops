import * as XLSX from 'xlsx';
import { store } from '../data/store';
import { getJobWithDetails, getApprovedJobsWithDetailsForUser } from './jobCalculationService';
import { getJobsForUser } from './jobScopeService';
import { getTeamsForUser } from './teamScopeService';
import { formatPriceForUser } from '../utils/priceRules';
import type { JobWithDetails } from '../types';
import type { User } from '../types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function exportJobsToExcel(companyId: string, user: User | undefined, options?: { status?: 'all' | 'approved'; locale?: string }) {
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
    'Total Work Value': j.status === 'approved' ? formatPriceForUser(j.totalWorkValue, user, 'companyOrTotal') : '',
    'Team Earnings': j.status === 'approved' ? formatPriceForUser(j.teamEarnings, user, 'teamOnly') : '',
    'Company Share': j.status === 'approved' ? formatPriceForUser(j.companyShare, user, 'companyOrTotal') : '',
    Notes: j.notes,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jobs');
  XLSX.writeFile(wb, `jobs-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportDashboardToExcel(companyId: string, user: User | undefined) {
  const approved = getApprovedJobsWithDetailsForUser(companyId, user);
  const daily = approved.filter((j) => {
    const d = j.date.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return d === today;
  });
  const weekly = approved.filter((j) => {
    const jd = new Date(j.date);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return jd >= start && jd < end;
  });
  const monthly = approved.filter((j) => j.date.slice(0, 7) === new Date().toISOString().slice(0, 7));

  const summary = [
    { Period: 'Daily', Count: daily.length, TotalValue: formatPriceForUser(daily.reduce((s, j) => s + j.totalWorkValue, 0), user, 'companyOrTotal'), TeamEarnings: formatPriceForUser(daily.reduce((s, j) => s + j.teamEarnings, 0), user, 'teamOnly'), CompanyShare: formatPriceForUser(daily.reduce((s, j) => s + j.companyShare, 0), user, 'companyOrTotal') },
    { Period: 'Weekly', Count: weekly.length, TotalValue: formatPriceForUser(weekly.reduce((s, j) => s + j.totalWorkValue, 0), user, 'companyOrTotal'), TeamEarnings: formatPriceForUser(weekly.reduce((s, j) => s + j.teamEarnings, 0), user, 'teamOnly'), CompanyShare: formatPriceForUser(weekly.reduce((s, j) => s + j.companyShare, 0), user, 'companyOrTotal') },
    { Period: 'Monthly', Count: monthly.length, TotalValue: formatPriceForUser(monthly.reduce((s, j) => s + j.totalWorkValue, 0), user, 'companyOrTotal'), TeamEarnings: formatPriceForUser(monthly.reduce((s, j) => s + j.teamEarnings, 0), user, 'teamOnly'), CompanyShare: formatPriceForUser(monthly.reduce((s, j) => s + j.companyShare, 0), user, 'companyOrTotal') },
  ];

  const ws = XLSX.utils.json_to_sheet(summary);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dashboard Summary');
  XLSX.writeFile(wb, `dashboard-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
