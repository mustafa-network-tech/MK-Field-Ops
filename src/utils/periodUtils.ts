/**
 * Payroll (Hakediş) period utilities.
 * Period starts on startDayOfMonth and ends the day before the same day next month.
 * Example: start day 20 → Feb 20 – Mar 19.
 */

export interface PayrollPeriod {
  /** Start date (inclusive) YYYY-MM-DD */
  start: string;
  /** End date (inclusive) YYYY-MM-DD */
  end: string;
  /** Optional label for display (e.g. "Feb 20 – Mar 19, 2025") */
  label?: string;
  /** True when this period contains today (current/active period) */
  isActive?: boolean;
}

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the active payroll period that contains the given date.
 * @param date Reference date (default: today)
 * @param startDayOfMonth Day of month when period starts (1–28)
 */
export function getActivePeriod(date: Date, startDayOfMonth: number): PayrollPeriod {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDate();

  let start: Date;
  if (day >= startDayOfMonth) {
    start = new Date(d.getFullYear(), d.getMonth(), startDayOfMonth);
  } else {
    start = new Date(d.getFullYear(), d.getMonth() - 1, startDayOfMonth);
  }
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDayOfMonth - 1);

  const startStr = toYYYYMMDD(start);
  const endStr = toYYYYMMDD(end);
  const label = formatPeriodLabel(startStr, endStr);
  return { start: startStr, end: endStr, label };
}

/**
 * Lists payroll periods: active first, then past periods.
 * @param startDayOfMonth Day of month when period starts (1–28)
 * @param referenceDate Reference date for "active" (default: today)
 * @param pastCount Number of past periods to include
 */
export function listPeriods(
  startDayOfMonth: number,
  referenceDate: Date,
  pastCount: number
): PayrollPeriod[] {
  const active = getActivePeriod(referenceDate, startDayOfMonth);
  const result: PayrollPeriod[] = [active];

  let start = new Date(active.start + 'T00:00:00');
  for (let i = 0; i < pastCount; i++) {
    start = new Date(start.getFullYear(), start.getMonth() - 1, startDayOfMonth);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, startDayOfMonth - 1);
    const startStr = toYYYYMMDD(start);
    const endStr = toYYYYMMDD(end);
    result.push({ start: startStr, end: endStr, label: formatPeriodLabel(startStr, endStr) });
  }

  return result;
}

/** Check if a job date (YYYY-MM-DD) falls within a period (start/end inclusive). */
export function isDateInPeriod(jobDate: string, period: PayrollPeriod): boolean {
  return jobDate >= period.start && jobDate <= period.end;
}

function formatPeriodLabel(startStr: string, endStr: string): string {
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}`;
}
