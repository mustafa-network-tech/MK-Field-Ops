import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { fetchAuditLogs, AUDIT_LOG_PAGE_SIZE, type AuditLogRow } from '../services/auditLogFetchService';
import { formatDate } from '../utils/formatLocale';
import styles from './AuditLogs.module.css';

export function AuditLogs() {
  const { t, locale } = useI18n();
  const { user } = useApp();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ rows: AuditLogRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const companyId = user?.companyId ?? '';
  const canAccess = user?.role === 'companyManager';

  useEffect(() => {
    if (!companyId || !canAccess) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAuditLogs(companyId, page).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setResult({ rows: res.rows, total: res.total });
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, canAccess, page]);

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('auditLogs.title')}</h1>
        <p className={styles.muted}>{t('errors.forbidden')}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('auditLogs.title')}</h1>
      <Card>
        {loading && <p className={styles.loading}>{t('common.loading')}</p>}
        {error && <p className={styles.error}>{error}</p>}
        {!loading && !error && result && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('auditLogs.date')}</th>
                    <th>{t('auditLogs.actor')}</th>
                    <th>{t('auditLogs.role')}</th>
                    <th>{t('auditLogs.action')}</th>
                    <th>{t('auditLogs.entity')}</th>
                    <th>{t('auditLogs.team')}</th>
                    <th>{t('auditLogs.period')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr>
                        <td>{formatDate(row.created_at, locale)}</td>
                        <td>{row.actor_email ?? row.actor_user_id}</td>
                        <td>{row.actor_role ?? '–'}</td>
                        <td>{row.action}</td>
                        <td>{row.entity_type}{row.entity_id ? ` #${row.entity_id.slice(0, 8)}` : ''}</td>
                        <td>{row.team_code ?? '–'}</td>
                        <td>{row.period_id ? String(row.period_id).slice(0, 8) : '–'}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.metaToggle}
                            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                            aria-expanded={expandedId === row.id}
                          >
                            {expandedId === row.id ? '▼' : '▶'} {t('auditLogs.meta')}
                          </button>
                        </td>
                      </tr>
                      {expandedId === row.id && (
                        <tr key={`${row.id}-meta`}>
                          <td colSpan={8} className={styles.metaCell}>
                            <pre className={styles.metaPre}>
                              {JSON.stringify(row.meta, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {result.rows.length === 0 && <p className={styles.noData}>{t('auditLogs.noData')}</p>}
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                {t('auditLogs.prevPage')}
              </button>
              <span className={styles.pageInfo}>
                {page * AUDIT_LOG_PAGE_SIZE + 1} – {page * AUDIT_LOG_PAGE_SIZE + result.rows.length} {result.total > 0 ? `/ ${result.total}` : ''}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={result.rows.length < AUDIT_LOG_PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('auditLogs.nextPage')}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
