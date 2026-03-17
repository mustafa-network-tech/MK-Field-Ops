import { useState, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getPayrollPeriods } from '../services/payrollPeriodService';
import { getPayrollReportData } from '../services/payrollReportService';
import {
  exportPayrollReportToExcel,
  exportPayrollReportToPdf,
  getPeriodLabelForTitle,
  type PayrollReportTranslations,
  type PayrollExportOptions,
} from '../services/payrollExportService';
import { getTeamsForUser } from '../services/teamScopeService';
import { logEvent, actorFromUser } from '../services/auditLogService';
import { Card } from '../components/ui/Card';
import styles from './Reports.module.css';

export function Reports() {
  const { t, locale } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const canAccessCompanyExport = user?.role === 'companyManager' || user?.role === 'projectManager';
  const teams = useMemo(() => getTeamsForUser(companyId, user), [companyId, user]);
  const periods = useMemo(() => getPayrollPeriods(companyId), [companyId]);
  const hasPayrollSettings = useMemo(() => !!store.getPayrollPeriodSettings(companyId), [companyId]);

  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [useDateRange, setUseDateRange] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  /** For company export: empty = all teams; otherwise only selected team IDs. */
  const [selectedCompanyTeamIds, setSelectedCompanyTeamIds] = useState<string[]>([]);
  /** For company export: full breakdown or only company share column. */
  const [companyReportView, setCompanyReportView] = useState<'full' | 'teamEarningsOnly'>('full');

  const selectedPeriod = periods[selectedPeriodIndex] ?? null;

  /** Effective period: payroll period (when not date range) or custom start/end (when date range valid). */
  const effectivePeriod = useMemo(() => {
    if (useDateRange) {
      if (dateRangeStart && dateRangeEnd && dateRangeStart <= dateRangeEnd) {
        return { start: dateRangeStart, end: dateRangeEnd };
      }
      return null;
    }
    return selectedPeriod;
  }, [useDateRange, dateRangeStart, dateRangeEnd, selectedPeriod]);

  function buildTranslations(
    reportType: 'company' | 'team',
    data: { companyName: string; period: { start: string }; teamCode?: string }
  ): PayrollReportTranslations {
    const periodLabel = getPeriodLabelForTitle(data.period.start, locale);
    const title =
      reportType === 'company'
        ? t('payroll.report.titleCompany', { companyName: data.companyName, periodLabel })
        : t('payroll.report.titleTeam', { teamCode: data.teamCode ?? '', periodLabel });
    return {
      title,
      companyName: t('payroll.report.companyName'),
      payrollPeriod: t('payroll.report.payrollPeriod'),
      exportDate: t('payroll.report.exportDate'),
      totalApprovedJobs: t('payroll.report.totalApprovedJobs'),
      totalAmount: t('payroll.report.totalAmount'),
      totalWorkValue: t('payroll.report.totalWorkValue'),
      teamEarnings: t('payroll.report.teamEarnings'),
      companyShare: t('payroll.report.companyShare'),
      completionDate: t('payroll.report.completionDate'),
      projectId: t('payroll.report.projectId'),
      teamCode: t('payroll.report.teamCode'),
      workItemName: t('payroll.report.workItemName'),
      quantity: t('payroll.report.quantity'),
      unitPrice: t('payroll.report.unitPrice'),
      lineTotal: t('payroll.report.lineTotal'),
      signatureProjectManager: t('payroll.report.signatureProjectManager'),
      signatureCompanyManager: t('payroll.report.signatureCompanyManager'),
      noApprovedJobsInPeriod: t('payroll.report.noApprovedJobsInPeriod'),
      footerGeneratedBy: t('payroll.report.footerGeneratedBy'),
      footerPageNumber: t('payroll.report.footerPageNumber'),
    };
  }

  const companyExportOptions: PayrollExportOptions = { companyViewMode: companyReportView };

  async function handleExportCompany(format: 'xlsx' | 'pdf') {
    if (!effectivePeriod) return;
    const teamFilter = selectedCompanyTeamIds.length > 0 ? selectedCompanyTeamIds : undefined;
    const data = getPayrollReportData(companyId, effectivePeriod, 'company', undefined, teamFilter);
    const tr = buildTranslations('company', data);
    if (format === 'xlsx') exportPayrollReportToExcel(data, tr, locale, companyExportOptions);
    else {
      await exportPayrollReportToPdf(data, tr, locale, companyExportOptions);
      const actor = actorFromUser(user);
      if (actor) {
        logEvent(actor, {
          action: 'EXPORT_PAYROLL_PDF',
          entity_type: 'export',
          period_id: null,
          company_id: companyId,
          meta: {
            exportType: 'company',
            totals: data.totals,
            period: data.period,
          },
        });
      }
    }
  }

  async function handleExportTeam(format: 'xlsx' | 'pdf') {
    if (!effectivePeriod || !selectedTeamId) return;
    const data = getPayrollReportData(companyId, effectivePeriod, 'team', selectedTeamId);
    const tr = buildTranslations('team', data);
    if (format === 'xlsx') exportPayrollReportToExcel(data, tr, locale);
    else {
      await exportPayrollReportToPdf(data, tr, locale);
      const actor = actorFromUser(user);
      if (actor) {
        logEvent(actor, {
          action: 'EXPORT_PAYROLL_PDF',
          entity_type: 'export',
          period_id: null,
          team_code: data.teamCode ?? null,
          company_id: companyId,
          meta: {
            exportType: 'team',
            teamCode: data.teamCode,
            totals: data.totals,
            period: data.period,
          },
        });
      }
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('reports.title')}</h1>

      {!hasPayrollSettings && (
        <Card>
          <p className={styles.muted}>{t('payroll.noSettings')}</p>
        </Card>
      )}

      {hasPayrollSettings && canAccessCompanyExport && (
        <Card title={t('payroll.title')}>
          <div className={styles.field}>
            <label>
              <input
                type="radio"
                checked={!useDateRange}
                onChange={() => setUseDateRange(false)}
              />
              {t('payroll.report.periodModePeriod')}
            </label>
            <label>
              <input
                type="radio"
                checked={useDateRange}
                onChange={() => setUseDateRange(true)}
              />
              {t('payroll.report.periodModeDateRange')}
            </label>
          </div>
          {!useDateRange && (
            <div className={styles.field}>
              <label htmlFor="report-period">{t('payroll.selectPeriod')}</label>
              <select
                id="report-period"
                value={selectedPeriodIndex}
                onChange={(e) => setSelectedPeriodIndex(Number(e.target.value))}
                className={styles.select}
              >
                {periods.map((p, i) => (
                  <option key={`${p.start}-${p.end}`} value={i}>
                    {p.label ?? `${p.start} – ${p.end}`}
                    {p.isActive ? ` (${t('payroll.active')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {useDateRange && (
            <>
              <div className={styles.field}>
                <label htmlFor="report-date-start">{t('payroll.report.startDate')}</label>
                <input
                  id="report-date-start"
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className={styles.select}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="report-date-end">{t('payroll.report.endDate')}</label>
                <input
                  id="report-date-end"
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className={styles.select}
                />
              </div>
            </>
          )}

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('payroll.report.sectionCompany')}</h3>
            <p className={styles.desc}>{t('payroll.report.companyName')}</p>
            <div className={styles.field}>
              <label className={styles.label}>{t('payroll.report.companyReportContent')}</label>
              <div className={styles.radioGroup}>
                <label>
                  <input
                    type="radio"
                    name="companyReportView"
                    checked={companyReportView === 'full'}
                    onChange={() => setCompanyReportView('full')}
                  />
                  {t('payroll.report.viewFull')}
                </label>
                <label>
                  <input
                    type="radio"
                    name="companyReportView"
                    checked={companyReportView === 'teamEarningsOnly'}
                    onChange={() => setCompanyReportView('teamEarningsOnly')}
                  />
                  {t('payroll.report.viewTeamEarningsOnly')}
                </label>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{t('payroll.report.filterTeams')}</label>
              <p className={styles.hint}>{t('payroll.report.filterTeamsHint')}</p>
              <div className={styles.teamCheckboxGroup}>
                {teams.map((team) => {
                  const isAll = selectedCompanyTeamIds.length === 0;
                  const checked = isAll || selectedCompanyTeamIds.includes(team.id);
                  return (
                    <label key={team.id} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (isAll) {
                            if (e.target.checked) {
                              setSelectedCompanyTeamIds([team.id]);
                            } else {
                              setSelectedCompanyTeamIds(teams.filter((t) => t.id !== team.id).map((t) => t.id));
                            }
                          } else if (e.target.checked) {
                            setSelectedCompanyTeamIds((prev) => [...prev, team.id]);
                          } else {
                            setSelectedCompanyTeamIds((prev) => prev.filter((id) => id !== team.id));
                          }
                        }}
                      />
                      {team.code} {team.description ? ` – ${team.description}` : ''}
                    </label>
                  );
                })}
              </div>
              {teams.length > 0 && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setSelectedCompanyTeamIds([])}
                >
                  {t('payroll.report.allTeams')}
                </button>
              )}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleExportCompany('xlsx')}
                disabled={!effectivePeriod}
              >
                {t('payroll.exportCompanyPayrollExcel')}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleExportCompany('pdf')}
                disabled={!effectivePeriod}
              >
                {t('payroll.exportCompanyPayrollPdf')}
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('payroll.report.titleTeam').split(' – ')[0]}</h3>
            <div className={styles.field}>
              <label htmlFor="report-team">{t('payroll.teamCode')}</label>
              <select
                id="report-team"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className={styles.select}
              >
                <option value="">{t('teams.selectTeam')}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.code} {team.description ? `– ${team.description}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleExportTeam('xlsx')}
                disabled={!effectivePeriod || !selectedTeamId}
              >
                {t('payroll.exportTeamPayrollExcel')}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleExportTeam('pdf')}
                disabled={!effectivePeriod || !selectedTeamId}
              >
                {t('payroll.exportTeamPayrollPdf')}
              </button>
            </div>
          </div>
        </Card>
      )}

      {hasPayrollSettings && user?.role === 'teamLeader' && (
        <Card title={t('payroll.title')}>
          <p className={styles.desc}>{t('payroll.report.sectionTeam')}</p>
          <div className={styles.field}>
            <label><input type="radio" checked={!useDateRange} onChange={() => setUseDateRange(false)} /> {t('payroll.report.periodModePeriod')}</label>
            <label><input type="radio" checked={useDateRange} onChange={() => setUseDateRange(true)} /> {t('payroll.report.periodModeDateRange')}</label>
          </div>
          {!useDateRange && (
            <div className={styles.field}>
              <label htmlFor="report-period-tl">{t('payroll.selectPeriod')}</label>
              <select
                id="report-period-tl"
                value={selectedPeriodIndex}
                onChange={(e) => setSelectedPeriodIndex(Number(e.target.value))}
                className={styles.select}
              >
                {periods.map((p, i) => (
                  <option key={`${p.start}-${p.end}`} value={i}>
                    {p.label ?? `${p.start} – ${p.end}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {useDateRange && (
            <>
              <div className={styles.field}>
                <label htmlFor="report-date-start-tl">{t('payroll.report.startDate')}</label>
                <input id="report-date-start-tl" type="date" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} className={styles.select} />
              </div>
              <div className={styles.field}>
                <label htmlFor="report-date-end-tl">{t('payroll.report.endDate')}</label>
                <input id="report-date-end-tl" type="date" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} className={styles.select} />
              </div>
            </>
          )}
          <div className={styles.field}>
            <label htmlFor="report-team-tl">{t('payroll.teamCode')}</label>
            <select
              id="report-team-tl"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className={styles.select}
            >
              <option value="">{t('teams.selectTeam')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.code}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => handleExportTeam('xlsx')}
              disabled={!effectivePeriod || !selectedTeamId}
            >
              {t('payroll.exportTeamPayrollExcel')}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => handleExportTeam('pdf')}
              disabled={!effectivePeriod || !selectedTeamId}
            >
              {t('payroll.exportTeamPayrollPdf')}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
