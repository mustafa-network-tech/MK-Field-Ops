import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { setSiteAccessUnlocked, verifySiteAccessPassword } from '../services/siteAccessGate';
import styles from './SiteAccessModal.module.css';

const ADMIN_EMAIL = 'mustafa82oner@gmail.com';

type Props = {
  open: boolean;
  /** blocking = no close control; dismissible = X + optional overlay intent */
  variant: 'blocking' | 'dismissible';
  onVerified: () => void;
  onClose?: () => void;
};

export function SiteAccessModal({ open, variant, onVerified, onClose }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    if (verifySiteAccessPassword(value)) {
      setSiteAccessUnlocked();
      onVerified();
      return;
    }
    setError(true);
  };

  const dismissible = variant === 'dismissible';

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={dismissible ? () => onClose?.() : undefined}
    >
      <div
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-access-title"
        onClick={(e) => e.stopPropagation()}
      >
        {dismissible && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => onClose?.()}
            aria-label={t('common.close')}
          >
            ×
          </button>
        )}
        <h2 id="site-access-title" className={styles.title}>
          {t('siteAccess.title')}
        </h2>
        <p className={styles.desc}>{t('siteAccess.description')}</p>
        <form onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="site-access-code">
            {t('siteAccess.passwordLabel')}
          </label>
          <input
            id="site-access-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            className={styles.input}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            autoFocus
          />
          {error && (
            <p className={styles.error}>
              {t('siteAccess.wrongPassword')}{' '}
              <a href={`mailto:${ADMIN_EMAIL}`}>{ADMIN_EMAIL}</a>
            </p>
          )}
          <button type="submit" className={styles.submitBtn}>
            {t('siteAccess.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
