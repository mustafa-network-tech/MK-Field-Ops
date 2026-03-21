import type { DashboardSummaryScope } from '../services/dashboardSummaryService';

const STORAGE_KEY = 'mkfieldops_dashboard_scope';

function parseStored(): Record<string, DashboardSummaryScope> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, DashboardSummaryScope> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === 'allTime' || v === 'payrollPeriod') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function readDashboardScope(companyId: string): DashboardSummaryScope {
  if (!companyId) return 'payrollPeriod';
  const v = parseStored()[companyId];
  return v === 'allTime' ? 'allTime' : 'payrollPeriod';
}

export function writeDashboardScope(companyId: string, scope: DashboardSummaryScope): void {
  if (!companyId) return;
  try {
    const next = { ...parseStored(), [companyId]: scope };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}
