import { store } from '../data/store';
import { getJobWithDetails } from './jobCalculationService';
import { getProjectDisplayKey } from '../utils/projectKey';
import { roundMoney } from '../utils/formatLocale';
import type { PayrollPeriod } from '../utils/periodUtils';
import type { JobWithDetails } from '../types';

/** Completion date for report: approvedAt if set, else job date. */
function completionDate(job: { approvedAt?: string | null; date: string }): string {
  const d = job.approvedAt ?? job.date;
  return d.slice(0, 10);
}

function isInPeriod(dateStr: string, period: PayrollPeriod): boolean {
  return dateStr >= period.start && dateStr <= period.end;
}

export type PayrollReportRow = {
  completionDate: string;
  projectId: string;
  teamCode: string;
  workItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PayrollReportData = {
  companyName: string;
  /** Company logo URL for PDF watermark; optional. */
  logo_url?: string | null;
  period: PayrollPeriod;
  exportDate: string;
  reportType: 'company' | 'team';
  teamCode?: string;
  teamName?: string;
  totals: { approvedJobsCount: number; totalAmount: number };
  jobs: PayrollReportRow[];
  isEmpty: boolean;
};

/**
 * Build report data: approved jobs whose completion date (approvedAt or date) falls within period.
 * No company/team share breakdown - only totals and job lines.
 */
export function getPayrollReportData(
  companyId: string,
  period: PayrollPeriod,
  reportType: 'company' | 'team',
  teamId?: string
): PayrollReportData {
  const company = store.getCompany(companyId, companyId);
  const companyName = company?.name ?? companyId;
  const teams = store.getTeams(companyId);
  const workItems = store.getWorkItems(companyId);
  const projects = store.getProjects(companyId);

  const allJobs = store.getJobs(companyId).filter((j) => j.status === 'approved');
  const withDetails: JobWithDetails[] = allJobs
    .map((j) => getJobWithDetails(j, companyId))
    .filter((j): j is JobWithDetails => j != null);

  const rows: PayrollReportRow[] = [];
  for (const j of withDetails) {
    const compDate = completionDate(j);
    if (!isInPeriod(compDate, period)) continue;
    if (reportType === 'team' && teamId && j.teamId !== teamId) continue;

    const team = teams.find((t) => t.id === j.teamId);
    const workItem = workItems.find((w) => w.id === j.workItemId);
    const project = j.projectId ? projects.find((p) => p.id === j.projectId) : undefined;
    const projectId = project ? getProjectDisplayKey(project) : (j.projectId ?? '');
    const teamCode = team?.code ?? j.teamId;
    const workItemName = workItem ? (workItem.description || workItem.code) : j.workItemId;
    const unitPrice = workItem?.unitPrice ?? 0;
    const lineTotal = roundMoney(j.quantity * unitPrice);

    rows.push({
      completionDate: compDate,
      projectId,
      teamCode,
      workItemName,
      quantity: j.quantity,
      unitPrice,
      lineTotal,
    });
  }

  rows.sort((a, b) => a.completionDate.localeCompare(b.completionDate));

  const totalAmount = roundMoney(rows.reduce((s, r) => s + r.lineTotal, 0));
  const teamInfo = reportType === 'team' && teamId ? teams.find((t) => t.id === teamId) : undefined;

  return {
    companyName,
    logo_url: company?.logo_url ?? null,
    period,
    exportDate: new Date().toISOString().slice(0, 10),
    reportType,
    teamCode: teamInfo?.code,
    teamName: teamInfo?.description,
    totals: { approvedJobsCount: rows.length, totalAmount },
    jobs: rows,
    isEmpty: rows.length === 0,
  };
}
