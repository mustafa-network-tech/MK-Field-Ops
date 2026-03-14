import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getEffectivePlan } from '../services/subscriptionService';
import { changeCompanyPlanInSupabase, fetchCompanyLanguageFromSupabase } from '../services/companyService';
import type { CompanyPlan } from '../types';
import styles from './PlanChange.module.css';

const PLANS: CompanyPlan[] = ['starter', 'professional', 'enterprise'];

function planLabel(plan: CompanyPlan, t: (k: string) => string): string {
  if (plan === 'starter') return t('landing.planStarter');
  if (plan === 'professional') return t('landing.planPro');
  if (plan === 'enterprise') return t('landing.planEnterprise');
  return plan;
}

export function PlanChange() {
  const { t } = useI18n();
  const { user, company, refreshCompany } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planFromUrl = searchParams.get('plan') as CompanyPlan | null;
  const validPlanFromUrl = planFromUrl && PLANS.includes(planFromUrl) ? planFromUrl : null;

  const [selectedPlan, setSelectedPlan] = useState<CompanyPlan | null>(validPlanFromUrl);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (validPlanFromUrl) setSelectedPlan(validPlanFromUrl);
  }, [validPlanFromUrl]);

  const companyId = user?.companyId ?? company?.id ?? '';
  const c = companyId ? store.getCompany(companyId, companyId) ?? company : undefined;
  const currentPlan = getEffectivePlan(c);
  const isCM = user?.role === 'companyManager';

  const handleConfirm = async () => {
    if (!selectedPlan || !companyId || !isCM) return;
    setError(null);
    setSubmitting(true);
    const result = await changeCompanyPlanInSupabase(companyId, selectedPlan, billingCycle, currentPlan);
    setSubmitting(false);
    if (result.ok) {
      await fetchCompanyLanguageFromSupabase(companyId);
      if (refreshCompany) refreshCompany();
      navigate('/plan', { replace: true });
    } else {
      setError(result.error ?? t('planChangePage.errorGeneric'));
    }
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('planChangePage.title')}</h1>
        <div className={styles.card}>
          {validPlanFromUrl ? (
            <>
              <p className={styles.planName}>{planLabel(validPlanFromUrl, t)}</p>
              <p className={styles.muted}>{t('planChangePage.signInToContinue')}</p>
              <div className={styles.actions}>
                <Link to="/login" className={styles.linkBtn}>{t('planChangePage.signIn')}</Link>
                <Link to="/register" className={styles.linkBtn}>{t('planChangePage.register')}</Link>
              </div>
            </>
          ) : (
            <p className={styles.muted}>{t('planChangePage.choosePlanOnLanding')}</p>
          )}
          <Link to="/" className={styles.backLink}>← {t('planChangePage.backToHome')}</Link>
        </div>
      </div>
    );
  }

  if (!user.companyId) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('planChangePage.title')}</h1>
        <div className={styles.card}>
          <p className={styles.muted}>{t('planChangePage.pendingJoin')}</p>
          <Link to="/pending-join" className={styles.backLink}>← {t('planChangePage.backToPending')}</Link>
        </div>
      </div>
    );
  }

  if (!isCM) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('planChangePage.title')}</h1>
        <div className={styles.card}>
          <p className={styles.muted}>{t('planChangePage.onlyCM')}</p>
          <Link to="/plan" className={styles.backLink}>← {t('planChangePage.backToPlan')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('planChangePage.title')}</h1>
      <div className={styles.card}>
        {validPlanFromUrl ? (
          <p className={styles.planName}>{planLabel(selectedPlan!, t)}</p>
        ) : (
          <>
            <p className={styles.muted} style={{ marginBottom: '0.75rem' }}>{t('planChangePage.selectPlan')}</p>
            <div className={styles.planSelect}>
              {PLANS.map((plan) => (
                <button
                  key={plan}
                  type="button"
                  className={styles.planOption}
                  data-selected={selectedPlan === plan}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <span className={styles.planOptionLabel}>{planLabel(plan, t)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className={styles.billingRow}>
          <span className={styles.billingLabel}>{t('planChangePage.billingCycle')}</span>
          <div className={styles.billingOptions}>
            <button
              type="button"
              className={styles.billingOption}
              data-active={billingCycle === 'monthly'}
              onClick={() => setBillingCycle('monthly')}
            >
              {t('planChangePage.monthly')}
            </button>
            <button
              type="button"
              className={styles.billingOption}
              data-active={billingCycle === 'yearly'}
              onClick={() => setBillingCycle('yearly')}
            >
              {t('planChangePage.yearly')}
            </button>
          </div>
        </div>

        <button
          type="button"
          className={styles.confirmBtn}
          disabled={!selectedPlan || submitting}
          onClick={handleConfirm}
        >
          {submitting ? t('planChangePage.confirming') : t('planChangePage.confirmPlan')}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Link to="/plan" className={styles.backLink}>← {t('planChangePage.backToPlan')}</Link>
      </div>
    </div>
  );
}
