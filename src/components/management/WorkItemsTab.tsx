import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { upsertWorkItem } from '../../services/supabaseSyncService';
import { validatePrice, formatPriceForUser } from '../../utils/priceRules';
import { parseDecimalFromLocale } from '../../utils/formatLocale';
import { Card } from '../ui/Card';
import type { WorkItem } from '../../types';
import styles from './ManagementTabs.module.css';

export function WorkItemsTab() {
  const { t, locale } = useI18n();
  const { user: currentUser } = useApp();
  const companyId = currentUser?.companyId ?? '';
  const workItems = store.getWorkItems(companyId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [form, setForm] = useState({ code: '', unitType: '', unitPrice: 0, description: '' });
  const [priceError, setPriceError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [unitTypeSearch, setUnitTypeSearch] = useState('');
  const [unitTypeError, setUnitTypeError] = useState('');

  const UNIT_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: 'm3', label: t('deliveryNotes.unitCubicMeter') },
    { value: 'kg', label: t('deliveryNotes.unitKilo') },
    { value: 'm', label: t('deliveryNotes.unitMeter') },
    { value: 'pcs', label: t('deliveryNotes.unitPiece') },
  ];

  const filteredWorkItems = workItems.filter((w) => {
    const term = searchTerm.trim().toLowerCase();
    const unitTerm = unitTypeSearch.trim().toLowerCase();
    const matchesTerm =
      !term ||
      w.code.toLowerCase().includes(term) ||
      (w.description ?? '').toLowerCase().includes(term);
    const matchesUnit = !unitTerm || w.unitType.toLowerCase().includes(unitTerm);
    return matchesTerm && matchesUnit;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPriceError('');
    setCodeError('');
    setUnitTypeError('');

    const rawCode = form.code.trim();
    if (!/^\d{5}$/.test(rawCode)) {
      setCodeError(t('catalog.codeMustBeFiveDigits'));
      return;
    }

    const isDuplicate = workItems.some(
      (w) => w.code === rawCode && (!editing || w.id !== editing.id)
    );
    if (isDuplicate) {
      setCodeError(t('catalog.codeMustBeUnique'));
      return;
    }

    if (!form.unitType.trim()) {
      setUnitTypeError(t('catalog.unitTypeRequired'));
      return;
    }

    const priceResult = validatePrice(form.unitPrice);
    if (!priceResult.ok) {
      setPriceError(t(priceResult.error));
      return;
    }
    if (priceResult.value <= 0) {
      setPriceError(t('catalog.unitPriceMustBePositive'));
      return;
    }
    const payload = { ...form, code: rawCode, unitPrice: priceResult.value };
    if (editing) {
      const updated = store.updateWorkItem(editing.id, payload);
      if (updated) upsertWorkItem(updated).catch(() => {});
      setEditing(null);
    } else {
      const added = store.addWorkItem({ companyId, ...payload });
      upsertWorkItem(added).catch(() => {});
      setShowForm(false);
    }
    setForm({ code: '', unitType: '', unitPrice: 0, description: '' });
  };

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('catalog.workItems')}</h3>
        <div className={styles.toolbarFilters}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.input}
            placeholder={t('common.search')}
          />
          <input
            type="text"
            value={unitTypeSearch}
            onChange={(e) => setUnitTypeSearch(e.target.value)}
            className={styles.input}
            placeholder={t('catalog.unitType')}
          />
        </div>
        {!editing && (
          <button type="button" className={styles.primaryBtn} onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancel') : t('catalog.addWorkItem')}
          </button>
        )}
      </div>
      {(showForm || editing) && (
        <form onSubmit={handleSave} className={styles.form}>
          <label className={styles.label}>
            {t('catalog.code')}
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={styles.input} required />
          </label>
          {codeError && <p className={styles.saveError}>{codeError}</p>}
          <label className={styles.label}>
            {t('catalog.unitType')}
            <select
              value={form.unitType}
              onChange={(e) => setForm((f) => ({ ...f, unitType: e.target.value }))}
              className={styles.input}
              required
            >
              <option value="">{t('deliveryNotes.selectUnitPlaceholder')}</option>
              {UNIT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {unitTypeError && <p className={styles.saveError}>{unitTypeError}</p>}
          <label className={styles.label}>
            {t('catalog.unitPrice')}
            <input
              type="text"
              inputMode="decimal"
              value={form.unitPrice}
              onChange={(e) => {
                const r = parseDecimalFromLocale(e.target.value, locale);
                if (r.ok && r.value >= 0) setForm((f) => ({ ...f, unitPrice: r.value }));
                else if (e.target.value.trim() === '') setForm((f) => ({ ...f, unitPrice: 0 }));
                setPriceError('');
              }}
              className={styles.input}
              required
            />
          </label>
          {priceError && <p className={styles.saveError}>{priceError}</p>}
          <label className={styles.label}>
            {t('catalog.workItemName')}
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={styles.input}
              required
            />
          </label>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>{t('common.save')}</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => { setShowForm(false); setEditing(null); setForm({ code: '', unitType: '', unitPrice: 0, description: '' }); }}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
      <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('catalog.code')}</th>
            <th>{t('catalog.unitType')}</th>
            <th>{t('catalog.unitPrice')}</th>
            <th>{t('catalog.workItemName')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredWorkItems.map((w) => (
            <tr key={w.id}>
              <td>{w.code}</td>
              <td>{w.unitType}</td>
              <td>{formatPriceForUser(w.unitPrice, currentUser, 'companyOrTotal', locale)}</td>
              <td>{w.description}</td>
              <td>
                <button type="button" className={styles.smallBtnEdit} onClick={() => { setEditing(w); setForm({ code: w.code, unitType: w.unitType, unitPrice: w.unitPrice, description: w.description }); }}>{t('common.edit')}</button>
                <button type="button" className={styles.smallBtnDanger} onClick={() => store.deleteWorkItem(w.id)}>{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {workItems.length === 0 && !showForm && <p className={styles.noData}>{t('common.noData')}</p>}
    </Card>
  );
}
