import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { validatePrice, formatPriceForUser } from '../../utils/priceRules';
import { Card } from '../ui/Card';
import type { WorkItem } from '../../types';
import styles from './ManagementTabs.module.css';

export function WorkItemsTab() {
  const { t } = useI18n();
  const { user: currentUser } = useApp();
  const companyId = currentUser?.companyId ?? '';
  const workItems = store.getWorkItems(companyId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [form, setForm] = useState({ code: '', unitType: '', unitPrice: 0, description: '' });
  const [priceError, setPriceError] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPriceError('');
    const priceResult = validatePrice(form.unitPrice);
    if (!priceResult.ok) {
      setPriceError(t(priceResult.error));
      return;
    }
    const payload = { ...form, unitPrice: priceResult.value };
    if (editing) {
      store.updateWorkItem(editing.id, payload);
      setEditing(null);
    } else {
      store.addWorkItem({ companyId, ...payload });
      setShowForm(false);
    }
    setForm({ code: '', unitType: '', unitPrice: 0, description: '' });
  };

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('catalog.workItems')}</h3>
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
          <label className={styles.label}>
            {t('catalog.unitType')}
            <input value={form.unitType} onChange={(e) => setForm((f) => ({ ...f, unitType: e.target.value }))} className={styles.input} />
          </label>
          <label className={styles.label}>
            {t('catalog.unitPrice')}
            <input type="number" step="0.01" min={0} value={form.unitPrice} onChange={(e) => { setForm((f) => ({ ...f, unitPrice: Number(e.target.value) || 0 })); setPriceError(''); }} className={styles.input} required />
          </label>
          {priceError && <p className={styles.saveError}>{priceError}</p>}
          <label className={styles.label}>
            {t('catalog.description')}
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={styles.input} />
          </label>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>{t('common.save')}</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => { setShowForm(false); setEditing(null); setForm({ code: '', unitType: '', unitPrice: 0, description: '' }); }}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('catalog.code')}</th>
            <th>{t('catalog.unitType')}</th>
            <th>{t('catalog.unitPrice')}</th>
            <th>{t('catalog.description')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {workItems.map((w) => (
            <tr key={w.id}>
              <td>{w.code}</td>
              <td>{w.unitType}</td>
              <td>{formatPriceForUser(w.unitPrice, currentUser, 'companyOrTotal')}</td>
              <td>{w.description}</td>
              <td>
                <button type="button" className={styles.smallBtnEdit} onClick={() => { setEditing(w); setForm({ code: w.code, unitType: w.unitType, unitPrice: w.unitPrice, description: w.description }); }}>{t('common.edit')}</button>
                <button type="button" className={styles.smallBtnDanger} onClick={() => store.deleteWorkItem(w.id)}>{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {workItems.length === 0 && !showForm && <p className={styles.noData}>{t('common.noData')}</p>}
    </Card>
  );
}
