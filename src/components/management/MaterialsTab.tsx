import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { validatePrice, formatPriceForUser } from '../../utils/priceRules';
import { Card } from '../ui/Card';
import type { Material } from '../../types';
import styles from './ManagementTabs.module.css';

export function MaterialsTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const materials = store.getMaterials(companyId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState({ code: '', price: 0 });
  const [priceError, setPriceError] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPriceError('');
    const priceResult = validatePrice(form.price);
    if (!priceResult.ok) {
      setPriceError(t(priceResult.error));
      return;
    }
    if (editing) {
      store.updateMaterial(editing.id, { code: form.code, price: priceResult.value });
      setEditing(null);
    } else {
      store.addMaterial({ companyId, code: form.code, price: priceResult.value });
      setShowForm(false);
    }
    setForm({ code: '', price: 0 });
  };

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('catalog.materials')}</h3>
        {!editing && (
          <button type="button" className={styles.primaryBtn} onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancel') : t('catalog.addMaterial')}
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
            {t('catalog.price')}
            <input type="number" step="0.01" min={0} value={form.price} onChange={(e) => { setForm((f) => ({ ...f, price: Number(e.target.value) || 0 })); setPriceError(''); }} className={styles.input} required />
          </label>
          {priceError && <p className={styles.saveError}>{priceError}</p>}
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>{t('common.save')}</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => { setShowForm(false); setEditing(null); setForm({ code: '', price: 0 }); }}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('catalog.code')}</th>
            <th>{t('catalog.price')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.id}>
              <td>{m.code}</td>
              <td>{formatPriceForUser(m.price, user, 'companyOrTotal')}</td>
              <td>
                <button type="button" className={styles.smallBtnEdit} onClick={() => { setEditing(m); setForm({ code: m.code, price: m.price }); }}>{t('common.edit')}</button>
                <button type="button" className={styles.smallBtnDanger} onClick={() => store.deleteMaterial(m.id)}>{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {materials.length === 0 && !showForm && <p className={styles.noData}>{t('common.noData')}</p>}
    </Card>
  );
}
