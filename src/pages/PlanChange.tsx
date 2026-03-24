import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { authService } from '../services/authService';
import { getEffectivePlan, isPlanUpgrade } from '../services/subscriptionService';
import { changeCompanyPlanInSupabase, renewCompanyPlanInSupabase, fetchCompanyLanguageFromSupabase } from '../services/companyService';
import {
  getPendingNewCompanySignup,
  clearPendingNewCompanySignup,
  type PendingNewCompanyPayload,
} from '../services/pendingNewCompanySignup';
import { supabase } from '../services/supabaseClient';
import { mockPaymentSuccessApi } from '../services/paidSignupApi';
import { getPaidSignupSession, clearPaidSignupSession, type PaidSignupSession } from '../services/paidSignupSession';
import type { CompanyPlan, User } from '../types';
import styles from './PlanChange.module.css';

const PLANS: CompanyPlan[] = ['starter', 'professional', 'enterprise'];

const PLAN_CONFIG: Record<
  CompanyPlan,
  { titleKey: string; priceMonthlyKey: string; priceYearlyKey: string; featureKeys: string[]; limitKeys?: string[] }
> = {
  starter: {
    titleKey: 'landing.planStarter',
    priceMonthlyKey: 'landing.pricingPriceStarterMonthly',
    priceYearlyKey: 'landing.pricingPriceStarterYearly',
    featureKeys: ['landing.pricingStarterFeature1', 'landing.pricingStarterFeature2', 'landing.pricingStarterFeature3', 'landing.pricingStarterFeature4'],
    limitKeys: ['landing.pricingStarterLimit1', 'landing.pricingStarterLimit2', 'landing.pricingStarterLimit3', 'landing.pricingStarterLimit4'],
  },
  professional: {
    titleKey: 'landing.planPro',
    priceMonthlyKey: 'landing.pricingPriceProMonthly',
    priceYearlyKey: 'landing.pricingPriceProYearly',
    featureKeys: ['landing.pricingProFeature1', 'landing.pricingProFeature2', 'landing.pricingProFeature3', 'landing.pricingProFeature4'],
    limitKeys: ['landing.pricingProOp1', 'landing.pricingProOp2', 'landing.pricingProOp3', 'landing.pricingProOp4'],
  },
  enterprise: {
    titleKey: 'landing.planEnterprise',
    priceMonthlyKey: 'landing.pricingPriceEnterpriseMonthly',
    priceYearlyKey: 'landing.pricingPriceEnterpriseYearly',
    featureKeys: [
      'landing.pricingEnterpriseFeature1',
      'landing.pricingEnterpriseFeature2',
      'landing.pricingEnterpriseFeature3',
      'landing.pricingEnterpriseFeature4',
      'landing.pricingEnterpriseFeature5',
      'landing.pricingEnterpriseFeature6',
      'landing.pricingEnterpriseFeature7',
    ],
    limitKeys: ['landing.pricingEnterpriseOp1', 'landing.pricingEnterpriseOp2', 'landing.pricingEnterpriseOp3', 'landing.pricingEnterpriseOp4', 'landing.pricingEnterpriseOp5'],
  },
};

function planLabel(plan: CompanyPlan, t: (k: string) => string): string {
  return t(PLAN_CONFIG[plan].titleKey);
}

/** Ödeme sonrası aktivasyon: Supabase → mock-payment Edge + giriş; yerel → registerNewCompany. */
function PendingNewCompanyCheckout({
  localPending,
  paidSession,
  validPlanFromUrl,
  setUser,
  refreshCompany,
  navigate,
}: {
  localPending: PendingNewCompanyPayload | null;
  paidSession: PaidSignupSession | null;
  validPlanFromUrl: CompanyPlan | null;
  setUser: (u: User | undefined) => void;
  refreshCompany?: () => void | Promise<void>;
  navigate: NavigateFunction;
}) {
  const { t, locale } = useI18n();
  const [selectedPlan, setSelectedPlan] = useState<CompanyPlan | null>(validPlanFromUrl ?? 'professional');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (validPlanFromUrl) setSelectedPlan(validPlanFromUrl);
  }, [validPlanFromUrl]);

  const handleConfirmPayment = async () => {
    if (!selectedPlan) return;
    setError(null);
    setSubmitting(true);
    try {
      if (paidSession && supabase) {
        await mockPaymentSuccessApi({
          pending_signup_id: paidSession.pending_signup_id,
          signup_token: paidSession.signup_token,
          password: paidSession.password,
          selected_plan: selectedPlan,
          billing_cycle: billingCycle,
        });
        const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
          email: paidSession.email,
          password: paidSession.password,
        });
        if (signErr) {
          setError(signErr.message);
          return;
        }
        const uid = signData.user?.id;
        if (!uid) {
          setError(t('planChangePage.errorGeneric'));
          return;
        }
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('id, company_id, role, full_name, role_approval_status, can_see_prices')
          .eq('id', uid)
          .single();
        if (profErr || !profile) {
          setError(t('planChangePage.errorGeneric'));
          return;
        }
        clearPaidSignupSession();
        store.setUserFromProfile(profile, signData.user?.email ?? paidSession.email);
        const logged = store.getCurrentUser();
        if (logged?.companyId) {
          const { fetchCompanyDataFromSupabase } = await import('../services/supabaseSyncService');
          await fetchCompanyDataFromSupabase(logged.companyId);
          await fetchCompanyLanguageFromSupabase(logged.companyId);
        }
        if (refreshCompany) await refreshCompany();
        setUser(store.getCurrentUser());
        navigate('/', { state: { planChangeSuccess: true }, replace: true });
        return;
      }

      if (localPending) {
        const result = await authService.registerNewCompany({
          email: localPending.email,
          password: localPending.password,
          fullName: localPending.fullName,
          companyName: localPending.companyName,
          joinCode: localPending.joinCode,
          plan: selectedPlan,
          billingCycle,
        });
        if (!result.ok) {
          setError(t(result.error ?? 'planChangePage.errorGeneric'));
          return;
        }
        clearPendingNewCompanySignup();
        const logged = store.getCurrentUser();
        if (logged) {
          setUser(logged);
          if (logged.companyId) {
            const { fetchCompanyDataFromSupabase } = await import('../services/supabaseSyncService');
            await fetchCompanyDataFromSupabase(logged.companyId);
            await fetchCompanyLanguageFromSupabase(logged.companyId);
          }
          if (refreshCompany) await refreshCompany();
          navigate('/', { state: { planChangeSuccess: true }, replace: true });
        } else {
          navigate('/login', { replace: true, state: { afterPaidRegistration: true } });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('planChangePage.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPrice =
    selectedPlan &&
    (billingCycle === 'monthly' ? t(PLAN_CONFIG[selectedPlan].priceMonthlyKey) : t(PLAN_CONFIG[selectedPlan].priceYearlyKey));
  const planStartDateLabel = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('planChangePage.paymentTitle')}</h1>
      <h2 className={styles.subtitle}>{t('planChangePage.completePaymentHeading')}</h2>
      <p className={styles.trialNote}>{t('planChangePage.newUserSevenDayTrial')}</p>

      <div className={styles.billingRow}>
        <span className={styles.billingLabel}>{t('planChangePage.billingCycle')}</span>
        <div className={styles.billingToggle}>
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

      <div className={styles.planGrid}>
        {PLANS.map((plan) => {
          const config = PLAN_CONFIG[plan];
          const isSelected = selectedPlan === plan;
          return (
            <button
              key={plan}
              type="button"
              className={styles.planCard}
              data-selected={isSelected}
              onClick={() => setSelectedPlan(plan)}
            >
              <h3 className={styles.planCardTitle}>{t(config.titleKey)}</h3>
              <p className={styles.planCardPrice}>
                {billingCycle === 'monthly' ? t(config.priceMonthlyKey) : t(config.priceYearlyKey)}{' '}
                <span className={styles.planCardPriceValidUntil}>{t('landing.pricingValidUntil')}</span>
              </p>
              <div className={styles.planCardDivider} />
              <p className={styles.planCardFeaturesTitle}>{t('landing.pricingFeaturesTitle')}</p>
              <ul className={styles.planCardList}>
                {config.featureKeys.map((key) => (
                  <li key={key}>
                    <span className={styles.planCardCheck} aria-hidden>✔</span>
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
              {config.limitKeys && config.limitKeys.length > 0 && (
                <>
                  <p className={styles.planCardFeaturesTitle}>
                    {plan === 'starter' ? t('landing.pricingLimitationsTitle') : t('landing.pricingOperationsTitle')}
                  </p>
                  <ul className={styles.planCardList}>
                    {config.limitKeys.map((key) => (
                      <li key={key}>
                        <span className={styles.planCardCheck} aria-hidden>✔</span>
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.summaryCard}>
        {selectedPlan ? (
          <>
            <p className={styles.summaryRow}>
              <span>{planLabel(selectedPlan, t)}</span>
              <strong>{selectedPrice}</strong>
            </p>
            <p className={styles.summaryRow}>
              <span>{t('planChangePage.planStartDate')}</span>
              <strong>{planStartDateLabel}</strong>
            </p>
            <p className={styles.totalRow}>
              <span>{t('planChangePage.total')}</span>
              <strong>{selectedPrice}</strong>
            </p>
            <button
              type="button"
              className={styles.confirmBtn}
              disabled={submitting}
              onClick={handleConfirmPayment}
            >
              {submitting ? t('planChangePage.confirming') : t('planChangePage.pay')}
            </button>
          </>
        ) : (
          <p className={styles.muted}>{t('planChangePage.selectPlan')}</p>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>

      <Link to="/register" className={styles.backLink}>
        ← {t('planChangePage.backToRegister')}
      </Link>
    </div>
  );
}

export function PlanChange() {
  const { t, locale } = useI18n();
  const { user, company, setUser, refreshCompany } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planFromUrl = searchParams.get('plan') as CompanyPlan | null;
  const validPlanFromUrl = planFromUrl && PLANS.includes(planFromUrl) ? planFromUrl : null;
  const fromRegistration = searchParams.get('from') === 'registration';
  const pendingLocal = getPendingNewCompanySignup();
  const paidSession = getPaidSignupSession();
  const pendingSignupIdFromUrl = searchParams.get('pending_signup_id');

  const supabaseSessionMatchesUrl =
    !pendingSignupIdFromUrl ||
    (paidSession !== null && paidSession.pending_signup_id === pendingSignupIdFromUrl);
  const isSupabasePaidCheckout = Boolean(
    fromRegistration && supabase && paidSession && supabaseSessionMatchesUrl,
  );
  const isLocalPaidCheckout = Boolean(fromRegistration && !supabase && pendingLocal);
  const isPrePaymentNewCompany = isSupabasePaidCheckout || isLocalPaidCheckout;

  const [selectedPlan, setSelectedPlan] = useState<CompanyPlan | null>(validPlanFromUrl);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = t('planChangePage.paymentTitle');
    return () => { document.title = 'MK-OPS'; };
  }, [t]);

  useEffect(() => {
    if (validPlanFromUrl) setSelectedPlan(validPlanFromUrl);
  }, [validPlanFromUrl]);

  useEffect(() => {
    if (user) {
      if (getPendingNewCompanySignup()) clearPendingNewCompanySignup();
      if (getPaidSignupSession()) clearPaidSignupSession();
    }
  }, [user]);

  if (
    fromRegistration &&
    !user &&
    supabase &&
    pendingSignupIdFromUrl &&
    paidSession &&
    paidSession.pending_signup_id !== pendingSignupIdFromUrl
  ) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('planChangePage.paymentTitle')}</h1>
        <div className={styles.card}>
          <p className={styles.muted}>{t('planChangePage.registrationSessionExpired')}</p>
          <Link to="/register" className={styles.linkBtn}>{t('planChangePage.register')}</Link>
          <Link to="/" className={styles.backLink}>← {t('planChangePage.backToHome')}</Link>
        </div>
      </div>
    );
  }

  if (fromRegistration && !user && supabase && pendingSignupIdFromUrl && !paidSession) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('planChangePage.paymentTitle')}</h1>
        <div className={styles.card}>
          <p className={styles.muted}>{t('planChangePage.registrationSessionExpired')}</p>
          <Link to="/register" className={styles.linkBtn}>{t('planChangePage.register')}</Link>
          <Link to="/" className={styles.backLink}>← {t('planChangePage.backToHome')}</Link>
        </div>
      </div>
    );
  }

  if (isPrePaymentNewCompany && !user && (paidSession || pendingLocal)) {
    return (
      <PendingNewCompanyCheckout
        localPending={isLocalPaidCheckout ? pendingLocal : null}
        paidSession={isSupabasePaidCheckout ? paidSession : null}
        validPlanFromUrl={validPlanFromUrl}
        setUser={setUser}
        refreshCompany={refreshCompany}
        navigate={navigate}
      />
    );
  }

  if (fromRegistration && !pendingLocal && !user && !supabase) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('planChangePage.paymentTitle')}</h1>
        <div className={styles.card}>
          <p className={styles.muted}>{t('planChangePage.registrationSessionExpired')}</p>
          <Link to="/register" className={styles.linkBtn}>{t('planChangePage.register')}</Link>
          <Link to="/" className={styles.backLink}>← {t('planChangePage.backToHome')}</Link>
        </div>
      </div>
    );
  }

  const companyId = user?.companyId ?? company?.id ?? '';
  const c = companyId ? store.getCompany(companyId, companyId) ?? company : undefined;
  const currentPlan = getEffectivePlan(c);
  const isCM = user?.role === 'companyManager';

  const handlePayment = async () => {
    if (!selectedPlan || !companyId || !isCM) return;
    setError(null);
    setSubmitting(true);
    const result = await changeCompanyPlanInSupabase(companyId, selectedPlan, billingCycle, currentPlan);
    setSubmitting(false);
    if (result.ok) {
      await fetchCompanyLanguageFromSupabase(companyId);
      if (refreshCompany) refreshCompany();
      navigate('/', { state: { planChangeSuccess: true }, replace: true });
    } else {
      setError(result.error ?? t('planChangePage.errorGeneric'));
    }
  };

  const handleRenew = async () => {
    if (!companyId || !isCM) return;
    setError(null);
    setSubmitting(true);
    const result = await renewCompanyPlanInSupabase(companyId, billingCycle);
    setSubmitting(false);
    if (result.ok) {
      await fetchCompanyLanguageFromSupabase(companyId);
      if (refreshCompany) refreshCompany();
      navigate('/', { state: { planChangeSuccess: true }, replace: true });
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
          <Link to="/" className={styles.backLink}>← {t('planChangePage.backToDashboard')}</Link>
        </div>
      </div>
    );
  }

  const planAlreadySet = selectedPlan && currentPlan === selectedPlan;
  if (planAlreadySet && fromRegistration) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{t('planChangePage.paymentTitle')}</h1>
        <div className={styles.card}>
          <p className={styles.planName}>{planLabel(selectedPlan, t)}</p>
          <p className={styles.muted}>{t('planChangePage.planSetWelcome')}</p>
          <Link to="/login" className={styles.confirmBtn}>{t('planChangePage.goToLogin')}</Link>
        </div>
      </div>
    );
  }

  const selectedPrice =
    selectedPlan &&
    (billingCycle === 'monthly' ? t(PLAN_CONFIG[selectedPlan].priceMonthlyKey) : t(PLAN_CONFIG[selectedPlan].priceYearlyKey));

  const planStartDateLabel = selectedPlan
    ? (() => {
        const upgrade = isPlanUpgrade(currentPlan, selectedPlan);
        const date = upgrade ? new Date() : (c?.plan_end_date ? new Date(c.plan_end_date) : new Date());
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
      })()
    : null;
  const isSamePlan = selectedPlan && currentPlan === selectedPlan;
  const planEndDateLabel = c?.plan_end_date
    ? new Date(c.plan_end_date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('planChangePage.paymentTitle')}</h1>
      <h2 className={styles.subtitle}>{t('planChangePage.completePaymentHeading')}</h2>

      <div className={styles.billingRow}>
        <span className={styles.billingLabel}>{t('planChangePage.billingCycle')}</span>
        <div className={styles.billingToggle}>
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

      <div className={styles.planGrid}>
        {PLANS.map((plan) => {
          const config = PLAN_CONFIG[plan];
          const isSelected = selectedPlan === plan;
          return (
            <button
              key={plan}
              type="button"
              className={styles.planCard}
              data-selected={isSelected}
              onClick={() => setSelectedPlan(plan)}
            >
              <h3 className={styles.planCardTitle}>{t(config.titleKey)}</h3>
              <p className={styles.planCardPrice}>
                {billingCycle === 'monthly' ? t(config.priceMonthlyKey) : t(config.priceYearlyKey)}{' '}
                <span className={styles.planCardPriceValidUntil}>{t('landing.pricingValidUntil')}</span>
              </p>
              <div className={styles.planCardDivider} />
              <p className={styles.planCardFeaturesTitle}>{t('landing.pricingFeaturesTitle')}</p>
              <ul className={styles.planCardList}>
                {config.featureKeys.map((key) => (
                  <li key={key}>
                    <span className={styles.planCardCheck} aria-hidden>✔</span>
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
              {config.limitKeys && config.limitKeys.length > 0 && (
                <>
                  <p className={styles.planCardFeaturesTitle}>
                    {plan === 'starter' ? t('landing.pricingLimitationsTitle') : t('landing.pricingOperationsTitle')}
                  </p>
                  <ul className={styles.planCardList}>
                    {config.limitKeys.map((key) => (
                      <li key={key}>
                        <span className={styles.planCardCheck} aria-hidden>✔</span>
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.summaryCard}>
        {selectedPlan ? (
          <>
            <p className={styles.summaryRow}>
              <span>{planLabel(selectedPlan, t)}</span>
              <strong>{selectedPrice}</strong>
            </p>
            {isSamePlan ? (
              <>
                <p className={styles.samePlanMessage}>
                  {t('planChangePage.alreadyHavePlan')}
                  {planEndDateLabel && ` ${t('planChangePage.planEndsOn', { date: planEndDateLabel })}`}
                  {' '}{t('planChangePage.renewPrompt')}
                </p>
                <p className={styles.totalRow}>
                  <span>{t('planChangePage.total')}</span>
                  <strong>{selectedPrice}</strong>
                </p>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  disabled={submitting}
                  onClick={handleRenew}
                >
                  {submitting ? t('planChangePage.confirming') : t('planChangePage.renew')}
                </button>
              </>
            ) : (
              <>
                {planStartDateLabel && (
                  <p className={styles.summaryRow}>
                    <span>{t('planChangePage.planStartDate')}</span>
                    <strong>{planStartDateLabel}</strong>
                  </p>
                )}
                <p className={styles.totalRow}>
                  <span>{t('planChangePage.total')}</span>
                  <strong>{selectedPrice}</strong>
                </p>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  disabled={submitting}
                  onClick={handlePayment}
                >
                  {submitting ? t('planChangePage.confirming') : t('planChangePage.pay')}
                </button>
              </>
            )}
          </>
        ) : (
          <p className={styles.muted}>{t('planChangePage.selectPlan')}</p>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>

      <Link to="/" className={styles.backLink}>← {t('planChangePage.backToDashboard')}</Link>
    </div>
  );
}
