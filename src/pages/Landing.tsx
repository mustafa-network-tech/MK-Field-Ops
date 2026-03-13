import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './Landing.module.css';

const langKeys: Record<string, string> = {
  en: 'topBar.langEn',
  tr: 'topBar.langTr',
  es: 'topBar.langEs',
  fr: 'topBar.langFr',
  de: 'topBar.langDe',
};
const LOCALES = ['en', 'tr', 'es', 'fr', 'de'] as const;

/** Landing sayfası logosu – navbar ve hero’da aynı dosya kullanılır; panel ayrı. */
const LANDING_LOGO_SRC = '/landing-logo.png';

/** Hero arka plan: 8 görsel – insansız, sadece ekipman/saha. Açılmayan ve insanlı görsel kaldırıldı. */
const HERO_BG_IMAGES: string[] = [
  'https://images.unsplash.com/photo-1769284022654-66c6b07dae78?w=1920&q=80',  // 1. bina inşaatı + kule vinç
  'https://images.pexels.com/photos/2138126/pexels-photo-2138126.jpeg?auto=compress&cs=tinysrgb&w=1920', // 2. inşaat vinçleri / bina
  'https://images.pexels.com/photos/2881224/pexels-photo-2881224.jpeg?auto=compress&cs=tinysrgb&w=1920', // 3. kablo / altyapı
  'https://images.pexels.com/photos/2101137/pexels-photo-2101137.jpeg?auto=compress&cs=tinysrgb&w=1920', // 4. kepçe / kazı
  'https://images.pexels.com/photos/8760709/pexels-photo-8760709.jpeg?auto=compress&cs=tinysrgb&w=1920', // 5. lojistik / forklift (açılmayan görsel yerine)
  'https://images.pexels.com/photos/6940962/pexels-photo-6940962.jpeg?auto=compress&cs=tinysrgb&w=1920', // 6. kamyon
  'https://images.pexels.com/photos/17743460/pexels-photo-17743460.jpeg?auto=compress&cs=tinysrgb&w=1920', // 7. inşaat sahası / maden (insansız; eskisi açılmıyordu)
  'https://images.pexels.com/photos/29422321/pexels-photo-29422321.jpeg?auto=compress&cs=tinysrgb&w=1920', // 8. yol / asfalt (insansız; eskisi açılmıyordu)
];

const HERO_SLIDE_INTERVAL_MS = 5000;
const HERO_FADE_DURATION_MS = 800;

/** Özellik kartları ikonları (dashboard, users, briefcase, handshake, boxes, activity) */
const FEATURE_ICONS = [
  /* 1 – Merkezi Operasyon Paneli: dashboard */
  <svg key="1" className={styles.featureIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  /* 2 – Ekip ve Rol: users */
  <svg key="2" className={styles.featureIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  /* 3 – Proje ve Görev: briefcase */
  <svg key="3" className={styles.featureIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  /* 4 – Taşeron: handshake / partnership (link) */
  <svg key="4" className={styles.featureIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
  /* 5 – Stok/Malzeme: boxes */
  <svg key="5" className={styles.featureIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  /* 6 – Gerçek Zamanlı: activity */
  <svg key="6" className={styles.featureIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
];

/** Fayda kartları ikonları: clock, chart, building */
const BENEFIT_ICONS = [
  <svg key="1" className={styles.benefitIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  <svg key="2" className={styles.benefitIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  <svg key="3" className={styles.benefitIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
];

/** Nasıl Çalışır adımları: company, users, briefcase, package */
const HOW_IT_WORKS_ICONS = [
  <svg key="1" className={styles.howItWorksIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><line x1="9" y1="22" x2="9" y2="12" /><line x1="15" y1="22" x2="15" y2="12" /></svg>,
  <svg key="2" className={styles.howItWorksIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  <svg key="3" className={styles.howItWorksIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  <svg key="4" className={styles.howItWorksIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
];

export function Landing() {
  const { t, locale, setLocale } = useI18n();
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setHeroSlideIndex((i) => (i + 1) % HERO_BG_IMAGES.length);
    }, HERO_SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [langOpen]);

  return (
    <div className={styles.page}>
      {/* 1) ÜST NAVBAR */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <a href="#hero" className={styles.logo}>
            <img src={LANDING_LOGO_SRC} alt="MK-OPS" className={styles.logoImg} />
            <span className={styles.logoText}>MK-OPS</span>
          </a>
          <nav className={styles.navLinks}>
            <a href="#who-we-are">{t('landing.navWhoWeAre')}</a>
            <a href="#features">{t('landing.navFeatures')}</a>
            <a href="#benefits">{t('landing.navBenefits')}</a>
            <a href="#pricing">{t('landing.navPricing')}</a>
            <a href="#support">{t('landing.navSupport')}</a>
          </nav>
          <div className={styles.navActions}>
            <Link to="/login" className={styles.navBtnSecondary}>{t('landing.navLogin')}</Link>
            <Link to="/register" className={styles.navBtnPrimary}>{t('landing.navStartFree')}</Link>
            <div className={styles.langDropdown} ref={langRef}>
              <button
                type="button"
                className={styles.langTrigger}
                onClick={() => setLangOpen((o) => !o)}
                aria-expanded={langOpen}
                aria-haspopup="listbox"
                aria-label={t('topBar.language')}
              >
                <span className={styles.langGlobe} aria-hidden>🌐</span>
                <span className={styles.langCode}>{locale.toUpperCase()}</span>
                <span className={styles.langChevron} aria-hidden>{langOpen ? '▴' : '▾'}</span>
              </button>
              {langOpen && (
                <ul className={styles.langMenu} role="listbox">
                  {LOCALES.map((loc) => (
                    <li key={loc} role="option" aria-selected={locale === loc}>
                      <button
                        type="button"
                        className={styles.langOption}
                        onClick={() => {
                          setLocale(loc);
                          setLangOpen(false);
                        }}
                      >
                        {t(langKeys[loc])}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2) HERO — arka plan slider + overlay + içerik */}
      <section id="hero" className={styles.hero}>
        <div className={styles.heroSlider} aria-hidden>
          {HERO_BG_IMAGES.map((src, i) => (
            <div
              key={src}
              className={styles.heroSlide}
              data-active={i === heroSlideIndex}
              style={{
                backgroundImage: `url(${src})`,
                transition: `opacity ${HERO_FADE_DURATION_MS}ms ease`,
              }}
            />
          ))}
        </div>
        <div className={styles.heroOverlay} aria-hidden />
        <div className={styles.heroInner}>
          <p className={styles.heroBrand}>MK-OPS</p>
          <h1 className={styles.heroTitle}>{t('landing.heroTitle')}</h1>
          {t('landing.heroSubtitle') && <p className={styles.heroSubtitle}>{t('landing.heroSubtitle')}</p>}
          <p className={styles.heroDescription}>{t('landing.heroDescription')}</p>
          <div className={styles.heroActions}>
            <Link to="/register" className={styles.heroBtnPrimary}>{t('landing.heroStartFree')}</Link>
            <Link to="/login" className={styles.heroBtnSecondary}>{t('landing.heroLogin')}</Link>
            <Link to="/kullanim-kilavuzu" className={styles.heroBtnGuide}>{t('landing.heroGuide')}</Link>
          </div>
        </div>
      </section>

      {/* 3) ÖZELLİKLER */}
      <section id="features" className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>{t('landing.featuresTitle')}</h2>
          <div className={styles.featureGrid}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={styles.featureCard}>
                <div className={styles.featureIcon}>{FEATURE_ICONS[i - 1]}</div>
                <h3 className={styles.featureCardTitle}>{t(`landing.feature${i}Title`)}</h3>
                <p className={styles.featureCardDesc}>{t(`landing.feature${i}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4) FAYDALAR */}
      <section id="benefits" className={styles.sectionAlt}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>{t('landing.benefitsTitle')}</h2>
          <div className={styles.benefitGrid}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.benefitCard}>
                <div className={styles.benefitIcon}>{BENEFIT_ICONS[i - 1]}</div>
                <h3 className={styles.benefitCardTitle}>{t(`landing.benefit${i}Title`)}</h3>
                <p className={styles.benefitCardDesc}>{t(`landing.benefit${i}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5) NASIL ÇALIŞIR */}
      <section id="how-it-works" className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>{t('landing.howItWorksTitle')}</h2>
          <div className={styles.howItWorksGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.howItWorksCard}>
                <div className={styles.howItWorksIcon}>{HOW_IT_WORKS_ICONS[i - 1]}</div>
                <h3 className={styles.howItWorksCardTitle}>{t(`landing.step${i}Title`)}</h3>
                <p className={styles.howItWorksCardDesc}>{t(`landing.step${i}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6) FİYATLANDIRMA */}
      <section id="pricing" className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.pricingHeader}>
            <h2 className={styles.sectionTitle}>{t('landing.pricingTitle')}</h2>
            <div className={styles.pricingSubtitle}>
              <span className={styles.pricingPill}>
                <span className={styles.pricingPillIcon} aria-hidden>
                  ✔
                </span>
                <span>{t('landing.pricingBadgeTrial')}</span>
              </span>
              <span className={styles.pricingPill}>
                <span className={styles.pricingPillIcon} aria-hidden>
                  ✔
                </span>
                <span>{t('landing.pricingBadgeCancel')}</span>
              </span>
            </div>
          </div>

          <div className={styles.pricingToggleRow}>
            <div
              className={styles.pricingToggle}
              role="tablist"
              aria-label={t('landing.pricingToggleAria')}
            >
              <button
                type="button"
                className={styles.pricingToggleOption}
                data-active={billingPeriod === 'monthly'}
                onClick={() => setBillingPeriod('monthly')}
                role="tab"
                aria-selected={billingPeriod === 'monthly'}
              >
                {t('landing.pricingToggleMonthly')}
              </button>
              <button
                type="button"
                className={styles.pricingToggleOption}
                data-active={billingPeriod === 'yearly'}
                onClick={() => setBillingPeriod('yearly')}
                role="tab"
                aria-selected={billingPeriod === 'yearly'}
              >
                {t('landing.pricingToggleYearly')}{' '}
                <span className={styles.pricingToggleBadge}>
                  {t('landing.pricingToggleYearlyBadge')}
                </span>
              </button>
            </div>
          </div>

          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <h3 className={styles.pricingCardTitle}>{t('landing.planStarter')}</h3>
              <p className={styles.pricingPrice}>
                {billingPeriod === 'monthly'
                  ? t('landing.pricingPriceStarterMonthly')
                  : t('landing.pricingPriceStarterYearly')}
              </p>
              <div className={styles.pricingDivider} />
              <div className={styles.pricingLists}>
                <div className={styles.pricingListGroup}>
                  <p className={styles.pricingListTitle}>
                    {t('landing.pricingFeaturesTitle')}
                  </p>
                  <ul className={styles.pricingList}>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingStarterFeature1')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingStarterFeature2')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingStarterFeature3')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingStarterFeature4')}</span>
                    </li>
                  </ul>
                </div>
                <div className={styles.pricingListGroup}>
                  <p className={styles.pricingListTitle}>
                    {t('landing.pricingLimitationsTitle')}
                  </p>
                  <ul className={styles.pricingList}>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingMinus} aria-hidden>—</span>
                      <span>{t('landing.pricingStarterLimit1')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingMinus} aria-hidden>—</span>
                      <span>{t('landing.pricingStarterLimit2')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingMinus} aria-hidden>—</span>
                      <span>{t('landing.pricingStarterLimit3')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingMinus} aria-hidden>—</span>
                      <span>{t('landing.pricingStarterLimit4')}</span>
                    </li>
                  </ul>
                </div>
              </div>
              <button type="button" className={styles.pricingButton}>
                {t('landing.navStartFree')}
              </button>
            </div>
            <div className={styles.pricingCardFeatured}>
              <h3 className={styles.pricingCardTitle}>{t('landing.planPro')}</h3>
              <p className={styles.pricingBadge}>
                <span className={styles.pricingBadgeStar} aria-hidden>
                  ★
                </span>
                {t('landing.pricingMostPopularBadge')}
              </p>
              <p className={styles.pricingPrice}>
                {billingPeriod === 'monthly'
                  ? t('landing.pricingPriceProMonthly')
                  : t('landing.pricingPriceProYearly')}
              </p>
              <div className={styles.pricingDivider} />
              <div className={styles.pricingLists}>
                <div className={styles.pricingListGroup}>
                  <p className={styles.pricingListTitle}>
                    {t('landing.pricingFeaturesTitle')}
                  </p>
                  <ul className={styles.pricingList}>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingProFeature1')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingProFeature2')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingProFeature3')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingProFeature4')}</span>
                    </li>
                  </ul>
                </div>
                <div className={styles.pricingListGroup}>
                  <p className={styles.pricingListTitle}>
                    {t('landing.pricingOperationsTitle')}
                  </p>
                  <ul className={styles.pricingList}>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingProOp1')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingProOp2')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingProOp3')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingProOp4')}</span>
                    </li>
                  </ul>
                </div>
              </div>
              <button type="button" className={styles.pricingButtonPrimary}>
                {t('landing.navStartFree')}
              </button>
            </div>
            <div className={styles.pricingCard}>
              <h3 className={styles.pricingCardTitle}>{t('landing.planEnterprise')}</h3>
              <p className={styles.pricingPrice}>
                {billingPeriod === 'monthly'
                  ? t('landing.pricingPriceEnterpriseMonthly')
                  : t('landing.pricingPriceEnterpriseYearly')}
              </p>
              <div className={styles.pricingDivider} />
              <div className={styles.pricingLists}>
                <div className={styles.pricingListGroup}>
                  <p className={styles.pricingListTitle}>
                    {t('landing.pricingFeaturesTitle')}
                  </p>
                  <ul className={styles.pricingList}>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseFeature1')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseFeature2')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseFeature3')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseFeature4')}</span>
                    </li>
                  </ul>
                </div>
                <div className={styles.pricingListGroup}>
                  <p className={styles.pricingListTitle}>
                    {t('landing.pricingOperationsTitle')}
                  </p>
                  <ul className={styles.pricingList}>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseOp1')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseOp2')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseOp3')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseOp4')}</span>
                    </li>
                    <li className={styles.pricingListItem}>
                      <span className={styles.pricingCheck} aria-hidden>✔</span>
                      <span>{t('landing.pricingEnterpriseOp5')}</span>
                    </li>
                  </ul>
                </div>
              </div>
              <button type="button" className={styles.pricingButton}>
                {t('landing.navStartFree')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6) CTA */}
      <section id="support" className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>{t('landing.ctaTitle')}</h2>
          <Link to="/register" className={styles.ctaButton}>{t('landing.ctaButton')}</Link>
        </div>
      </section>

      {/* 7) FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <span className={styles.footerBrandName}>MK-OPS</span>
              <p className={styles.footerTagline}>{t('landing.footerTagline')}</p>
            </div>
            <nav className={styles.footerLinks} aria-label="Footer">
              <Link to="/gizlilik-politikasi" className={styles.footerLink}>{t('landing.footerPrivacy')}</Link>
              <Link to="/kullanim-sartlari" className={styles.footerLink}>{t('landing.footerTerms')}</Link>
              <Link to="/geri-odeme-politikasi" className={styles.footerLink}>{t('landing.footerRefund')}</Link>
              <Link to="/kullanim-kilavuzu" className={styles.footerLink}>{t('landing.footerGuide')}</Link>
            </nav>
          </div>
          <div className={styles.footerBottom}>
            <p className={styles.footerCopyright}>{t('landing.footerCopyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
