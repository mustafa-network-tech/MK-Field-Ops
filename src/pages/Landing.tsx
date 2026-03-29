import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './Landing.module.css';

const LOCALES = ['en', 'tr', 'es', 'fr', 'de'] as const;

const LANDING_LOGO_SRC = '/landing-logo.png';

const HERO_BG =
  'https://images.unsplash.com/photo-1769284022654-66c6b07dae78?w=1920&q=80';

/** Tanıtım videosu (YouTube ID). Tanımlıysa embed; değilse public MP4. */
const PROMO_VIDEO_ID =
  (import.meta.env.VITE_LANDING_PROMO_VIDEO_ID as string | undefined)?.trim() ||
  (import.meta.env.VITE_LANDING_DEMO_VIDEO_ID as string | undefined)?.trim() ||
  '';

const rawPromoPath = (import.meta.env.VITE_LANDING_PROMO_VIDEO_PATH as string | undefined)?.trim();
const PROMO_VIDEO_PATH = rawPromoPath && rawPromoPath.length > 0 ? rawPromoPath : '/demo/mk-ops.mp4';

const LIVE_DEMO_URL =
  (import.meta.env.VITE_LANDING_LIVE_DEMO_URL as string | undefined)?.trim() ||
  'https://mkops-demo.vercel.app/login';

const WHATSAPP_PHONE_E164 =
  (import.meta.env.VITE_LANDING_WHATSAPP_E164 as string | undefined)?.trim().replace(/^\+/, '') || '905456597551';

function buildWhatsAppUrl(phoneE164: string, text: string): string {
  const num = phoneE164.replace(/^\+/, '');
  const q = text.trim() ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${num}${q}`;
}

const SOLUTION_ICONS = [
  <svg key="j" className={styles.blockIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
  <svg key="m" className={styles.blockIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  <svg key="e" className={styles.blockIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
];

const HOW_ICONS = [
  <svg key="1" className={styles.blockIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>,
  <svg key="2" className={styles.blockIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  <svg key="3" className={styles.blockIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
];

export function Landing() {
  const { t, locale, setLocale } = useI18n();
  const location = useLocation();
  const [langOpen, setLangOpen] = useState(false);
  const [langMenuPos, setLangMenuPos] = useState<CSSProperties>({});
  const langRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLUListElement>(null);

  const scrollToQuote = useCallback(() => {
    document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (location.pathname === '/pricing' || location.hash === '#pricing' || location.hash === '#quote') {
      const el = document.getElementById('quote');
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.pathname, location.hash]);

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

  useLayoutEffect(() => {
    if (!langOpen) {
      setLangMenuPos({});
      return;
    }
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
      if (left + mw > window.innerWidth - pad) {
        left = Math.max(pad, window.innerWidth - mw - pad);
      }
      let top = tr.bottom + 4;
      if (top + mh > window.innerHeight - pad && tr.top > mh + pad) {
        top = tr.top - mh - 4;
      }
      setLangMenuPos({
        position: 'fixed',
        top: Math.round(top),
        left: Math.round(left),
        right: 'auto',
        margin: 0,
      });
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
      t('landing.quoteWhatsAppPrefill'),
      '',
      `${t('landing.quoteName')}: ${name}`,
      `${t('landing.quoteCompany')}: ${company}`,
      `${t('landing.quoteEmail')}: ${email}`,
      `${t('landing.quotePhone')}: ${phone}`,
      `${t('landing.quoteProjectType')}: ${projectType}`,
    ];
    if (description) {
      lines.push('', `${t('landing.quoteDescription')}:`, description);
    }
    const url = buildWhatsAppUrl(WHATSAPP_PHONE_E164, lines.join('\n'));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const solutionKeys = ['solutionBlock1', 'solutionBlock2', 'solutionBlock3'] as const;
  const howKeys = [
    { title: 'howStep1Title', desc: 'howStep1Desc' },
    { title: 'howStep2Title', desc: 'howStep2Desc' },
    { title: 'howStep3Title', desc: 'howStep3Desc' },
  ] as const;

  return (
    <div className={styles.page}>
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <a href="#hero" className={styles.logo}>
            <img src={LANDING_LOGO_SRC} alt="MK-OPS" className={styles.logoImg} />
            <span className={styles.logoText}>MK-OPS</span>
          </a>
          <nav className={styles.navLinks} aria-label="Sayfa">
            <a href="#problem">{t('landing.navProblem')}</a>
            <a href="#solution">{t('landing.navSolution')}</a>
            <a href="#how-it-works">{t('landing.navHow')}</a>
            <a href={LIVE_DEMO_URL} target="_blank" rel="noopener noreferrer">
              {t('landing.navDemo')}
            </a>
            <a href="#quote">{t('landing.navQuote')}</a>
          </nav>
          <div className={styles.navActions}>
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
                      <button
                        type="button"
                        className={styles.langOption}
                        onClick={() => {
                          setLocale(loc);
                          setLangOpen(false);
                        }}
                      >
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

      <section id="hero" className={styles.hero}>
        <div
          className={styles.heroBg}
          style={{ backgroundImage: `url(${HERO_BG})` }}
          aria-hidden
        />
        <div className={styles.heroOverlay} aria-hidden />
        <div className={styles.heroFadeBottom} aria-hidden />
        <div className={styles.heroInner}>
          <p className={styles.heroBrand}>MKOps</p>
          <h1 className={styles.heroTitle}>{t('landing.heroTitle')}</h1>
          {t('landing.heroSubtitle') ? <p className={styles.heroSubtitle}>{t('landing.heroSubtitle')}</p> : null}
          <div className={styles.heroActions}>
            <a
              href={LIVE_DEMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.heroBtnPrimary}
            >
              {t('landing.btnInspectDemo')}
            </a>
            <button type="button" className={styles.heroBtnSecondary} onClick={scrollToQuote}>
              {t('landing.btnGetQuote')}
            </button>
          </div>
        </div>
      </section>

      <section id="problem" className={styles.sectionProblem}>
        <div className={styles.sectionProblemGlow} aria-hidden />
        <div className={styles.cinematicInner}>
          <p className={styles.sectionEyebrow}>{t('landing.navProblem')}</p>
          <h2 className={styles.titleCinematic}>{t('landing.problemTitle')}</h2>
          <p className={styles.leadCinematic}>{t('landing.problemSubtitle')}</p>
          <ul className={styles.problemStripes}>
            <li className={styles.problemStripe}>
              <span className={styles.problemStripeMark} aria-hidden />
              <span className={styles.problemStripeText}>{t('landing.problem1')}</span>
            </li>
            <li className={styles.problemStripe}>
              <span className={styles.problemStripeMark} aria-hidden />
              <span className={styles.problemStripeText}>{t('landing.problem2')}</span>
            </li>
            <li className={styles.problemStripe}>
              <span className={styles.problemStripeMark} aria-hidden />
              <span className={styles.problemStripeText}>{t('landing.problem3')}</span>
            </li>
          </ul>
        </div>
      </section>

      <section id="solution" className={styles.sectionSolution}>
        <div className={styles.cinematicInner}>
          <p className={styles.sectionEyebrowLight}>{t('landing.navSolution')}</p>
          <h2 className={styles.titleSolution}>MKOps</h2>
          <p className={styles.leadSolution}>{t('landing.solutionLead')}</p>
          <div className={styles.filmCardGrid}>
            {solutionKeys.map((key, i) => (
              <div key={key} className={styles.filmCard}>
                <span className={styles.filmCardIndex}>{String(i + 1).padStart(2, '0')}</span>
                <div className={styles.filmCardIcon}>{SOLUTION_ICONS[i]}</div>
                <h3 className={styles.filmCardTitle}>{t(`landing.${key}`)}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.sectionHow}>
        <div className={styles.sectionHowAccent} aria-hidden />
        <div className={styles.cinematicInner}>
          <p className={styles.sectionEyebrow}>{t('landing.navHow')}</p>
          <h2 className={styles.titleCinematic}>{t('landing.howTitle')}</h2>
          <div className={styles.timelineGrid}>
            {howKeys.map((row, i) => (
              <div key={row.title} className={styles.timelineCard}>
                <span className={styles.timelineStep}>{String(i + 1).padStart(2, '0')}</span>
                <div className={styles.timelineIcon}>{HOW_ICONS[i]}</div>
                <h3 className={styles.timelineTitle}>{t(`landing.${row.title}`)}</h3>
                <p className={styles.timelineDesc}>{t(`landing.${row.desc}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="promo-video" className={styles.sectionDemo}>
        <div className={styles.demoTheater}>
          <div className={styles.cinematicInner}>
            <h2 className={styles.titleDemo}>{t('landing.promoVideoSectionTitle')}</h2>
            <p className={styles.promoVideoLead}>{t('landing.promoVideoCaption')}</p>
            <div className={styles.videoFrame}>
              <div className={styles.videoFrameInner}>
                {PROMO_VIDEO_ID ? (
                  <div className={styles.videoRatio}>
                    <iframe
                      title={t('landing.promoVideoAriaTitle')}
                      src={`https://www.youtube-nocookie.com/embed/${PROMO_VIDEO_ID}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className={styles.videoRatio}>
                    <video
                      className={styles.promoVideoEl}
                      src={PROMO_VIDEO_PATH}
                      controls
                      playsInline
                      preload="metadata"
                      aria-label={t('landing.promoVideoAriaTitle')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="quote" className={styles.quoteSection}>
        <div className={styles.quoteGlow} aria-hidden />
        <div className={styles.cinematicInner}>
          <h2 className={styles.quoteTitle}>{t('landing.quoteTitle')}</h2>
          <p className={styles.quoteSubtitle}>{t('landing.quoteSubtitle')}</p>
          <form className={styles.quoteForm} onSubmit={onQuoteSubmit}>
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
          </form>
        </div>
      </section>

      <section id="contact" className={styles.contactSection}>
        <div className={styles.cinematicInner}>
          <h2 className={styles.titleContact}>{t('landing.contactSectionTitle')}</h2>
          <div className={styles.contactRow}>
            <a href={t('landing.contactWebsiteUrl')} target="_blank" rel="noopener noreferrer" className={styles.contactLink}>
              {t('landing.contactWebsiteLabel')}: mustafaoner.net
            </a>
            <a href={`mailto:${t('landing.contactEmailValue')}`} className={styles.contactLink}>
              {t('landing.contactEmailLabel')}: {t('landing.contactEmailValue')}
            </a>
            <a
              href={buildWhatsAppUrl(WHATSAPP_PHONE_E164, t('landing.quoteWhatsAppPrefill'))}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.contactLink}
            >
              {t('landing.contactWhatsAppLabel')}
            </a>
          </div>
        </div>
      </section>

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
