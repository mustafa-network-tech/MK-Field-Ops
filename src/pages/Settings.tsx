import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { Card } from '../components/ui/Card';
import { uploadCompanyLogo, isAllowedLogoFile } from '../services/companyLogoService';
import {
  fetchCompanyJoinCodeFromSupabase,
  updateCompanyJoinCodeInSupabase,
  updateCompanyBrandingInSupabase,
  updatePayrollStartDayInSupabase,
  requestCompanyClosureInSupabase,
} from '../services/companyService';
import { logEvent, actorFromUser } from '../services/auditLogService';
import styles from './Settings.module.css';

const START_DAY_MIN = 1;
const START_DAY_MAX = 28;

export function Settings() {
  const { t } = useI18n();
  const { user, company: appCompany } = useApp();
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
  const [payrollSaving, setPayrollSaving] = useState(false);

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
  const [closureStep, setClosureStep] = useState<0 | 1 | 2>(0);
  const [closureCountdown, setClosureCountdown] = useState(10);
  const [closureSubmitting, setClosureSubmitting] = useState(false);
  const [closureMessage, setClosureMessage] = useState<'saved' | 'error' | null>(null);
  const [closureError, setClosureError] = useState('');

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

  /** Girişte Supabase’ten gelen hakediş günü store’a yazılınca formu güncelle */
  useEffect(() => {
    if (!companyId) return;
    const ex = store.getPayrollPeriodSettings(companyId);
    setStartDay(ex ? String(ex.startDayOfMonth) : '20');
  }, [companyId, appCompany]);

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

  useEffect(() => {
    if (closureStep !== 2) return;
    if (closureCountdown <= 0) return;
    const timer = window.setTimeout(() => setClosureCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [closureStep, closureCountdown]);

  useEffect(() => {
    if (closureStep !== 2 || closureCountdown > 0 || closureSubmitting) return;
    if (!companyId || !canEditCompany) return;
    setClosureSubmitting(true);
    setClosureError('');
    void requestCompanyClosureInSupabase(companyId)
      .then((res) => {
        if (res.ok) {
          setClosureMessage('saved');
        } else {
          setClosureMessage('error');
          setClosureError(res.error ?? 'Şirket kapatma işlemi başarısız.');
        }
      })
      .catch(() => {
        setClosureMessage('error');
        setClosureError('Şirket kapatma işlemi başarısız.');
      })
      .finally(() => {
        setClosureSubmitting(false);
        setClosureStep(0);
        setClosureCountdown(10);
      });
  }, [closureStep, closureCountdown, closureSubmitting, companyId, canEditCompany]);

  const logoPreviewUrl = removeLogo ? null : (pendingFile ? pendingPreviewUrl : logoUrl);
  const purgeAfterLabel = company?.purge_after ? new Date(company.purge_after).toLocaleString() : null;

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('settings.title')}</h1>
        <p className={styles.muted}>{t('settings.accessRestricted')}</p>
      </div>
    );
  }

  const handleSave = async () => {
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
    setPayrollSaving(true);
    try {
      const remote = await updatePayrollStartDayInSupabase(companyId, num, user.id);
      if (!remote.ok) {
        setMessage('error');
        setValidationError(remote.error ?? t('settings.payrollSyncError'));
        return;
      }
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
    } finally {
      setPayrollSaving(false);
    }
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
      const nextName = companyName.trim() || company?.name || 'Company';
      const branding = await updateCompanyBrandingInSupabase(companyId, {
        name: nextName,
        logo_url: newLogoUrl,
      });
      if (!branding.ok) {
        setLogoError(branding.error ?? t('settings.logoUploadError'));
        setCompanyMessage('error');
        return;
      }
      store.updateCompany(companyId, { name: nextName, logo_url: newLogoUrl }, companyId);
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
        <p className={styles.hint}>{t('settings.payrollSyncHint')}</p>
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
            disabled={payrollSaving}
          />
        </div>
        {validationError && <p className={styles.error}>{validationError}</p>}
        {message === 'saved' && <p className={styles.success}>{t('settings.saved')}</p>}
        {message === 'error' && !validationError && <p className={styles.error}>{t('settings.payrollSyncError')}</p>}
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => void handleSave()}
          disabled={payrollSaving}
        >
          {payrollSaving ? t('common.saving') : t('settings.save')}
        </button>
      </Card>

      {canEditCompany && (
        <Card title="Şirketi Kapat">
          <p className={styles.hint}>
            Bu işlem erişimi anında kapatır. Veriler 30 gün bulutta saklanır; 30 gün sonra kalıcı silinir.
          </p>
          {company?.subscription_status === 'closed' && purgeAfterLabel && (
            <p className={styles.warningText}>
              Şirket kapanış modunda. Kalıcı silinme zamanı: {purgeAfterLabel}
            </p>
          )}
          {closureMessage === 'saved' && (
            <p className={styles.success}>Şirket kapatma talebi alındı. Erişim kısa süre içinde kapanacaktır.</p>
          )}
          {closureMessage === 'error' && (
            <p className={styles.error}>{closureError || 'İşlem başarısız oldu.'}</p>
          )}
          {closureStep === 0 && (
            <button
              type="button"
              className={styles.btnDangerDark}
              onClick={() => {
                setClosureMessage(null);
                setClosureError('');
                setClosureStep(1);
              }}
              disabled={closureSubmitting || company?.subscription_status === 'closed'}
            >
              Şirketi Kapat
            </button>
          )}
          {closureStep === 1 && (
            <div className={styles.closureBox}>
              <p className={styles.warningText}>Bu işlem tüm kullanıcı erişimini kapatır. Devam etmek istiyor musunuz?</p>
              <div className={styles.closureActions}>
                <button type="button" className={styles.btnDangerDark} onClick={() => { setClosureStep(2); setClosureCountdown(10); }}>
                  Evet, devam et
                </button>
                <button type="button" className={styles.btnSecondary} onClick={() => setClosureStep(0)}>
                  Geri dön
                </button>
              </div>
            </div>
          )}
          {closureStep === 2 && (
            <div className={styles.closureBox}>
              <p className={styles.warningText}>
                Son onay: {closureCountdown} saniye sonra şirket kapanacak.
              </p>
              <div className={styles.closureActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => { setClosureStep(0); setClosureCountdown(10); }}>
                  Geri dön
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
