import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { Card } from '../components/ui/Card';
import { uploadCompanyLogo, isAllowedLogoFile } from '../services/companyLogoService';
import { fetchCompanyJoinCodeFromSupabase, updateCompanyJoinCodeInSupabase } from '../services/companyService';
import { pushCompanyDataToSupabase } from '../services/supabaseSyncService';
import { supabase } from '../services/supabaseClient';
import { logEvent, actorFromUser } from '../services/auditLogService';
import styles from './Settings.module.css';

const START_DAY_MIN = 1;
const START_DAY_MAX = 28;

export function Settings() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const canAccess = user?.role === 'companyManager' || user?.role === 'projectManager';
  const canEditCompany = user?.role === 'companyManager';

  const company = companyId ? store.getCompany(companyId, companyId) : undefined;
  const existing = store.getPayrollPeriodSettings(companyId);
  const [startDay, setStartDay] = useState<string>(
    existing ? String(existing.startDayOfMonth) : '20'
  );
  const [message, setMessage] = useState<'saved' | 'error' | null>(null);
  const [validationError, setValidationError] = useState('');

  const [companyName, setCompanyName] = useState(company?.name ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(company?.logo_url ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [companyMessage, setCompanyMessage] = useState<'saved' | 'error' | null>(null);
  const [logoError, setLogoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joinCodeMessage, setJoinCodeMessage] = useState<'saved' | 'error' | null>(null);

  const [migrateMessage, setMigrateMessage] = useState<'success' | 'error' | null>(null);
  const [migrateLoading, setMigrateLoading] = useState(false);

  useEffect(() => {
    if (company) {
      setCompanyName(company.name);
      setLogoUrl(company.logo_url ?? null);
    }
  }, [company?.id, company?.name, company?.logo_url]);

  useEffect(() => {
    if (!canEditCompany || !companyId) return;
    fetchCompanyJoinCodeFromSupabase(companyId).then((code) => setJoinCode(code ?? ''));
  }, [canEditCompany, companyId]);

  useEffect(() => {
    if (!pendingFile) {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const logoPreviewUrl = removeLogo ? null : (pendingFile ? pendingPreviewUrl : logoUrl);

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('settings.title')}</h1>
        <p className={styles.muted}>{t('settings.accessRestricted')}</p>
      </div>
    );
  }

  const handleSave = () => {
    setValidationError('');
    setMessage(null);
    const num = parseInt(startDay, 10);
    if (Number.isNaN(num)) {
      setValidationError(t('settings.validation.startDayRequired'));
      return;
    }
    if (num < START_DAY_MIN || num > START_DAY_MAX) {
      setValidationError(t('settings.validation.startDayRange'));
      return;
    }
    if (!user?.id) return;
    const prev = store.getPayrollPeriodSettings(companyId);
    store.setPayrollPeriodSettings(companyId, {
      startDayOfMonth: num,
      updatedBy: user.id,
    });
    const actor = actorFromUser(user);
    if (actor) {
      logEvent(actor, {
        action: 'PAYROLL_SETTINGS_CHANGED',
        entity_type: 'payroll_period',
        company_id: companyId,
        meta: { startDayOfMonth: num, previousStartDay: prev?.startDayOfMonth },
      });
    }
    setMessage('saved');
  };

  const onCompanyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLogoError('');
    if (!file) return;
    const check = isAllowedLogoFile(file);
    if (!check.ok) {
      setLogoError(check.error);
      return;
    }
    setPendingFile(file);
    setRemoveLogo(false);
    e.target.value = '';
  };

  const handleSaveCompany = async () => {
    if (!companyId || !canEditCompany) return;
    setCompanyMessage(null);
    setJoinCodeMessage(null);
    setLogoError('');
    try {
      let newLogoUrl: string | null = logoUrl;
      if (removeLogo) {
        newLogoUrl = null;
      } else if (pendingFile) {
        const result = await uploadCompanyLogo(pendingFile, companyId);
        if ('error' in result) {
          setLogoError(result.error === 'BUCKET_NOT_FOUND' ? t('settings.logoBucketMissing') : result.error);
          setCompanyMessage('error');
          return;
        }
        newLogoUrl = result.url;
      }
      const prevName = company?.name;
      const prevLogo = company?.logo_url ?? null;
      store.updateCompany(companyId, { name: companyName.trim() || company?.name, logo_url: newLogoUrl }, companyId);
      setLogoUrl(newLogoUrl);
      setPendingFile(null);
      setRemoveLogo(false);
      if (/^\d{4}$/.test(joinCode.trim())) {
        const res = await updateCompanyJoinCodeInSupabase(companyId, joinCode.trim());
        if (res.ok) setJoinCodeMessage('saved');
        else setJoinCodeMessage('error');
      }
      setCompanyMessage('saved');
      const actor = actorFromUser(user);
      if (actor) {
        if (prevName !== (companyName.trim() || company?.name)) {
          logEvent(actor, {
            action: 'COMPANY_NAME_CHANGED',
            entity_type: 'company',
            entity_id: companyId,
            company_id: companyId,
            meta: { oldValue: prevName, newValue: companyName.trim() || company?.name },
          });
        }
        if (prevLogo !== newLogoUrl) {
          logEvent(actor, {
            action: 'COMPANY_LOGO_CHANGED',
            entity_type: 'company',
            entity_id: companyId,
            company_id: companyId,
            meta: { removed: newLogoUrl === null },
          });
        }
      }
    } catch {
      setCompanyMessage('error');
      setLogoError(t('settings.logoUploadError'));
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('settings.title')}</h1>

      {canEditCompany && (
        <Card title={t('settings.company')}>
          <p className={styles.hint}>{t('settings.logoFileLimit')}</p>
          <div className={styles.field}>
            <label htmlFor="companyName">{t('settings.companyName')}</label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('settings.companyNamePlaceholder')}
              className={styles.inputFull}
            />
          </div>
          <div className={styles.field}>
            <label>{t('settings.companyLogo')}</label>
            <div className={styles.logoRow}>
              {logoPreviewUrl ? (
                <div className={styles.logoPreviewWrap}>
                  <img src={logoPreviewUrl} alt="" className={styles.logoPreview} />
                  <div className={styles.logoActions}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                      className={styles.hiddenInput}
                      onChange={onCompanyFileChange}
                    />
                    <button type="button" className={styles.btnSecondary} onClick={() => fileInputRef.current?.click()}>
                      {t('settings.replaceLogo')}
                    </button>
                    <button type="button" className={styles.btnSecondary} onClick={() => { setRemoveLogo(true); setPendingFile(null); }}>
                      {t('settings.removeLogo')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                    className={styles.hiddenInput}
                    onChange={onCompanyFileChange}
                  />
                  <button type="button" className={styles.btnSecondary} onClick={() => fileInputRef.current?.click()}>
                    {t('settings.uploadLogo')}
                  </button>
                </>
              )}
            </div>
            {logoError && <p className={styles.error}>{logoError}</p>}
            {companyMessage === 'saved' && <p className={styles.success}>{t('settings.companySaved')}</p>}
            {companyMessage === 'error' && <p className={styles.error}>{t('settings.logoUploadError')}</p>}
          </div>
          <div className={styles.field}>
            <label htmlFor="joinCode">{t('settings.joinCode')}</label>
            <p className={styles.hint}>{t('settings.joinCodeHint')}</p>
            <input
              id="joinCode"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              className={styles.inputFull}
            />
            {joinCodeMessage === 'saved' && <p className={styles.success}>{t('settings.saved')}</p>}
            {joinCodeMessage === 'error' && <p className={styles.error}>{t('auth.joinCodeInvalid')}</p>}
          </div>
          <button type="button" className={styles.btnPrimary} onClick={handleSaveCompany}>
            {t('settings.save')}
          </button>
        </Card>
      )}

      {!canEditCompany && canAccess && (
        <p className={styles.muted}>{t('settings.companyProfileRestricted')}</p>
      )}

      <Card title={t('settings.payrollPeriod')}>
        <p className={styles.hint}>{t('settings.startDayOfMonthHint')}</p>
        <div className={styles.field}>
          <label htmlFor="startDay">{t('settings.startDayOfMonth')}</label>
          <input
            id="startDay"
            type="number"
            min={START_DAY_MIN}
            max={START_DAY_MAX}
            value={startDay}
            onChange={(e) => setStartDay(e.target.value)}
            className={styles.input}
          />
        </div>
        {validationError && <p className={styles.error}>{validationError}</p>}
        {message === 'saved' && <p className={styles.success}>{t('settings.saved')}</p>}
        <button type="button" className={styles.btnPrimary} onClick={handleSave}>
          {t('settings.save')}
        </button>
      </Card>

      {supabase && canEditCompany && companyId && (
        <Card title={t('settings.migrateExistingTitle')}>
          <p className={styles.hint}>{t('settings.migrateExistingHint')}</p>
          {migrateMessage === 'success' && <p className={styles.success}>{t('settings.migrateExistingSuccess')}</p>}
          {migrateMessage === 'error' && <p className={styles.error}>{t('settings.migrateExistingError')}</p>}
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={migrateLoading}
            onClick={async () => {
              setMigrateMessage(null);
              setMigrateLoading(true);
              const result = await pushCompanyDataToSupabase(companyId);
              setMigrateLoading(false);
              setMigrateMessage(result.ok ? 'success' : 'error');
            }}
          >
            {migrateLoading ? t('settings.migrateExistingLoading') : t('settings.migrateExistingButton')}
          </button>
        </Card>
      )}
    </div>
  );
}
