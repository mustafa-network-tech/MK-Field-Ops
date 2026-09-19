import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useI18n } from '@/lib/i18n/I18nContext';
import styles from './Landing.module.css';
import { SolutionLinks } from '@/features/product/ProductPages';
import { contact, contactUrl, solutions } from '@/features/product/content';

const LOCALES = ['en', 'tr', 'es', 'fr', 'de'] as const;
const LANDING_LOGO_SRC = '/landing-logo.png';
const HERO_BG = '/image/hero.jpeg';
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const DEMO_URL = contact.demo;

const WHATSAPP_PHONE_E164 = contact.phone;

function buildWhatsAppUrl(phoneE164: string, text: string): string {
  const num = phoneE164.replace(/^\+/, '');
  const q = text.trim() ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${num}${q}`;
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      delay: i * 0.08,
    },
  }),
};

const FEATURE_CARDS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    titleKey: 'feat1Title' as const,
    descKey: 'feat1Desc' as const,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    titleKey: 'feat2Title' as const,
    descKey: 'feat2Desc' as const,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    titleKey: 'feat3Title' as const,
    descKey: 'feat3Desc' as const,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    titleKey: 'feat4Title' as const,
    descKey: 'feat4Desc' as const,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    titleKey: 'feat5Title' as const,
    descKey: 'feat5Desc' as const,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    titleKey: 'feat6Title' as const,
    descKey: 'feat6Desc' as const,
  },
];

const TRUST_ITEMS = [
  'Hakediş Yönetimi',
  'Ekip Yönetimi',
  'Malzeme Takibi',
  'Günlük İş Takibi',
  'Denetim',
  'Raporlama',
];

export function Landing() {
  const { t, locale, setLocale } = useI18n();
  const location = useLocation();
  const [langOpen, setLangOpen] = useState(false);
  const [langMenuPos, setLangMenuPos] = useState<CSSProperties>({});
  const [scrolled, setScrolled] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLUListElement>(null);

  const scrollToQuote = useCallback(() => {
    document.getElementById('quote')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (location.pathname === '/pricing' || location.hash === '#pricing' || location.hash === '#quote') {
      const el = document.getElementById('quote');
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [langOpen]);

  useBrowserLayoutEffect(() => {
    if (!langOpen) { setLangMenuPos({}); return; }
    const positionMenu = () => {
      const wrap = langRef.current;
      const menu = langMenuRef.current;
      if (!wrap || !menu) return;
      const tr = wrap.getBoundingClientRect();
      const pad = 8;
      const mw = menu.offsetWidth;
      const mh = menu.offsetHeight;
      let left = tr.right - mw;
      if (left < pad) left = pad;
      if (left + mw > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - mw - pad);
      let top = tr.bottom + 4;
      if (top + mh > window.innerHeight - pad && tr.top > mh + pad) top = tr.top - mh - 4;
      setLangMenuPos({ position: 'fixed', top: Math.round(top), left: Math.round(left), right: 'auto', margin: 0 });
    };
    positionMenu();
    window.addEventListener('resize', positionMenu);
    return () => window.removeEventListener('resize', positionMenu);
  }, [langOpen]);

  const onQuoteSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const company = String(fd.get('company') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    const projectType = String(fd.get('projectType') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim();
    const lines = [
      t('landing.quoteWhatsAppPrefill'), '',
      `${t('landing.quoteName')}: ${name}`,
      `${t('landing.quoteCompany')}: ${company}`,
      `${t('landing.quoteEmail')}: ${email}`,
      `${t('landing.quotePhone')}: ${phone}`,
      `${t('landing.quoteProjectType')}: ${projectType}`,
    ];
    if (description) lines.push('', `${t('landing.quoteDescription')}:`, description);
    window.open(buildWhatsAppUrl(WHATSAPP_PHONE_E164, lines.join('\n')), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skipLink}>İçeriğe geç</a>

      {/* ── NAVBAR ── */}
      <header className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ''}`}>
        <div className={styles.navInner}>
          <a href="#hero" className={styles.logo}>
            <img src={LANDING_LOGO_SRC} alt="MK-OPS" width="36" height="36" className={styles.logoImg} />
            <span className={styles.logoText}>MK-OPS</span>
          </a>

          <nav className={styles.navLinks} aria-label="Sayfa">
            <a href="#solutions">Çözümler</a>
            <a href="#features">{t('landing.navFeatures') || 'Özellikler'}</a>
            <a href="#how-it-works">{t('landing.navHow')}</a>
            <a href="#quote">{t('landing.navQuote')}</a>
            <Link to="/login">{t('landing.navLogin')}</Link>
          </nav>

          <div className={styles.navActions}>
            <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className={styles.navDemoBtn}>
              🚀 {t('landing.heroDemo') || 'Canlı Demo'}
            </a>
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
                <ul ref={langMenuRef} className={styles.langMenu} style={langMenuPos} role="listbox">
                  {LOCALES.map((loc) => (
                    <li key={loc} role="option" aria-selected={locale === loc}>
                      <button type="button" className={styles.langOption}
                        onClick={() => { setLocale(loc); setLangOpen(false); }}>
                        {loc.toUpperCase()}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <main id="main-content">
      <section id="hero" className={styles.hero}>
        <div className={styles.heroBg} style={{ backgroundImage: `url(${HERO_BG})` }} aria-hidden />
        <div className={styles.heroOverlay} aria-hidden />
        <div className={styles.heroInner}>
          <motion.div
            className={styles.heroContent}
            initial={false}
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.span className={styles.heroBadge} variants={fadeUp}>
              Fiber · Telekom · Altyapı
            </motion.span>
            <motion.h1 className={styles.heroTitle} variants={fadeUp}>
              Saha Operasyon Yönetim Sistemi<br />
              <span className={styles.heroTitleAccent}>MK OPS</span>
            </motion.h1>
            <motion.p className={styles.heroSubtitle} variants={fadeUp}>
              MK OPS; telekom ve fiber altyapı ekiplerinin günlük iş, malzeme, onay ve hakediş kayıtlarını bir araya getirir. Proje ve ekip bazında yapılan işi kaydedin, onaylı üretimi dönem raporlarında değerlendirin.
            </motion.p>
            <motion.div className={styles.heroActions} variants={fadeUp}>
              <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className={styles.heroBtnPrimary}>
                🚀 Canlı Demo
              </a>
              <a href="#quote" className={styles.heroBtnSecondary} onClick={scrollToQuote}>
                📄 Teklif Al
              </a>
              <Link to="/login" className={styles.heroBtnOutline}>
                🔐 Giriş Yap
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className={styles.trustBar}>
        <div className={styles.trustInner}>
          {TRUST_ITEMS.map((item) => (
            <div key={item} className={styles.trustItem}>
              <svg className={styles.trustCheck} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd" />
              </svg>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className={styles.featuresSection}>
        <div className={styles.sectionInner}>
          <motion.div
            className={styles.sectionHeader}
            initial={false}
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <span className={styles.eyebrow}>{t('landing.navFeatures') || 'Özellikler'}</span>
            <h2 className={styles.sectionTitle}>Sahadan Ofise, Her Şey Tek Platformda</h2>
            <p className={styles.sectionLead}>Saha operasyonlarınızı dijitalleştiren altı güçlü modül.</p>
          </motion.div>

          <div className={styles.featureGrid}>
            {FEATURE_CARDS.map((card, i) => (
              <motion.div
                key={card.titleKey}
                className={styles.featureCard}
                initial={false}
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                custom={i}
                variants={fadeUp}
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(37,99,235,0.12)' }}
              >
                <div className={styles.featureIcon}>{card.icon}</div>
                <h3 className={styles.featureTitle}>{solutions[i + 1].title}</h3>
                <p className={styles.featureDesc}>{solutions[i + 1].description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className={styles.howSection}>
        <div className={styles.sectionInner}>
          <motion.div
            className={styles.sectionHeader}
            initial={false}
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <span className={styles.eyebrow}>{t('landing.navHow')}</span>
            <h2 className={styles.sectionTitle}>{t('landing.howTitle')}</h2>
          </motion.div>
          <div className={styles.howGrid}>
            {[
              { step: '01', titleKey: 'howStep1Title', descKey: 'howStep1Desc' },
              { step: '02', titleKey: 'howStep2Title', descKey: 'howStep2Desc' },
              { step: '03', titleKey: 'howStep3Title', descKey: 'howStep3Desc' },
            ].map((row, i) => (
              <motion.div
                key={row.step}
                className={styles.howCard}
                initial={false}
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                custom={i}
                variants={fadeUp}
              >
                <span className={styles.howStep}>{row.step}</span>
                <h3 className={styles.howTitle}>{t(`landing.${row.titleKey}`)}</h3>
                <p className={styles.howDesc}>{t(`landing.${row.descKey}`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Verified product capabilities and solution cluster. */}
      <SolutionLinks />

      <section className={styles.ctaSection}>
        <div className={styles.sectionInner}>
          <motion.div
            className={styles.ctaContent}
            initial={false}
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <h2 className={styles.ctaTitle}>Saha Operasyonlarınızı Dijitalleştirmeye<br />Hazır mısınız?</h2>
            <p className={styles.ctaDesc}>Günlük iş, onay ve hakediş akışının operasyonunuza nasıl uyduğunu inceleyin.</p>
            <div className={styles.ctaActions}>
              <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className={styles.ctaBtnPrimary}>
                🚀 Canlı Demo
              </a>
              <a href="#quote" className={styles.ctaBtnSecondary} onClick={scrollToQuote}>
                📄 Teklif Al
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── QUOTE FORM ── */}
      <section id="quote" className={styles.quoteSection}>
        <div className={styles.sectionInner}>
          <motion.div
            initial={false}
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <span className={styles.eyebrow}>{t('landing.navQuote')}</span>
            <h2 className={styles.sectionTitle}>{t('landing.quoteTitle')}</h2>
            <p className={styles.sectionLead}>{t('landing.quoteSubtitle')}</p>
          </motion.div>
          <motion.form
            id="quote-form"
            className={styles.quoteForm}
            onSubmit={onQuoteSubmit}
            initial={false}
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.15 } } }}
          >
            <div className={styles.quoteRow}>
              <label className={styles.quoteLabel}>
                <span>{t('landing.quoteName')}</span>
                <input name="name" type="text" required autoComplete="name" className={styles.quoteInput} />
              </label>
              <label className={styles.quoteLabel}>
                <span>{t('landing.quoteCompany')}</span>
                <input name="company" type="text" autoComplete="organization" className={styles.quoteInput} />
              </label>
            </div>
            <div className={styles.quoteRow}>
              <label className={styles.quoteLabel}>
                <span>{t('landing.quoteEmail')}</span>
                <input name="email" type="email" required autoComplete="email" className={styles.quoteInput} />
              </label>
              <label className={styles.quoteLabel}>
                <span>{t('landing.quotePhone')}</span>
                <input name="phone" type="tel" autoComplete="tel" className={styles.quoteInput} />
              </label>
            </div>
            <label className={styles.quoteLabel}>
              <span>{t('landing.quoteProjectType')}</span>
              <input name="projectType" type="text" autoComplete="off" className={styles.quoteInput} />
            </label>
            <label className={styles.quoteLabel}>
              <span>{t('landing.quoteDescription')}</span>
              <textarea name="description" rows={4} className={styles.quoteTextarea} />
            </label>
            <button type="submit" className={styles.quoteSubmit}>
              {t('landing.quoteRequestSubmit')}
            </button>
            <p className={styles.quoteFormFootnote}>{t('landing.quoteFormFootnote')}</p>
          </motion.form>
          <noscript><style>{'#quote-form { display: none; }'}</style><p><a href={contactUrl}>WhatsApp üzerinden ürün hakkında bilgi alın</a></p></noscript>
        </div>
      </section>

      {/* ── FOOTER ── */}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <a href="#hero" className={styles.footerLogo}>
                <img src={LANDING_LOGO_SRC} alt="MK-OPS" width="28" height="28" loading="lazy" className={styles.footerLogoImg} />
                <span>MK-OPS</span>
              </a>
              <p className={styles.footerTagline}>{t('landing.footerTagline')}</p>
            </div>

            <div className={styles.footerCols}>
              <div className={styles.footerCol}>
                <h4 className={styles.footerColTitle}>Platform</h4>
                <a href="#features" className={styles.footerLink}>Özellikler</a>
                <a href="#how-it-works" className={styles.footerLink}>{t('landing.navHow')}</a>
                <a href="#solutions" className={styles.footerLink}>Çözümler</a>
              </div>
              <div className={styles.footerCol}>
                <h4 className={styles.footerColTitle}>İletişim</h4>
                <a href={t('landing.contactWebsiteUrl')} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
                  mustafaoner.net
                </a>
                <a href={`mailto:${t('landing.contactEmailValue')}`} className={styles.footerLink}>
                  {t('landing.contactEmailValue')}
                </a>
                <a href={buildWhatsAppUrl(WHATSAPP_PHONE_E164, t('landing.quoteWhatsAppPrefill'))} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
                  WhatsApp
                </a>
              </div>
              <div className={styles.footerCol}>
                <h4 className={styles.footerColTitle}>Yasal</h4>
                <Link to="/gizlilik-politikasi" className={styles.footerLink}>{t('landing.footerPrivacy')}</Link>
                <Link to="/kullanim-sartlari" className={styles.footerLink}>{t('landing.footerTerms')}</Link>
                <Link to="/geri-odeme-politikasi" className={styles.footerLink}>{t('landing.footerRefund')}</Link>
                <Link to="/kullanim-kilavuzu" className={styles.footerLink}>{t('landing.footerGuide')}</Link>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p className={styles.footerCopyright}>{t('landing.footerCopyright')}</p>
            <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className={styles.footerDemoLink}>
              🚀 Canlı Demo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
