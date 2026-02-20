import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { Card } from '../ui/Card';
import type { Vehicle } from '../../types';
import styles from './ManagementTabs.module.css';

export function VehiclesTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const vehicles = store.getVehicles(companyId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({ plateNumber: '', brand: '', model: '', description: '' });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      store.updateVehicle(editing.id, { plateNumber: form.plateNumber, brand: form.brand, model: form.model, description: form.description || undefined });
      setEditing(null);
    } else {
      store.addVehicle({ companyId, ...form, description: form.description || undefined });
      setShowForm(false);
    }
    setForm({ plateNumber: '', brand: '', model: '', description: '' });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ plateNumber: '', brand: '', model: '', description: '' });
  };

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('vehicle.title')}</h3>
        {!editing && (
          <button type="button" className={styles.primaryBtn} onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancel') : t('vehicle.addVehicle')}
          </button>
        )}
      </div>
      {(showForm || editing) && (
        <form onSubmit={handleSave} className={styles.form}>
          <label className={styles.label}>
            {t('vehicle.plateNumber')}
            <input value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))} className={styles.input} required />
          </label>
          <label className={styles.label}>
            {t('vehicle.brand')}
            <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} className={styles.input} required />
          </label>
          <label className={styles.label}>
            {t('vehicle.model')}
            <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className={styles.input} required />
          </label>
          <label className={styles.label}>
            {t('catalog.description')}
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={styles.input} />
          </label>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>{t('common.save')}</button>
            <button type="button" className={styles.secondaryBtn} onClick={resetForm}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('vehicle.plateNumber')}</th>
            <th>{t('vehicle.brand')}</th>
            <th>{t('vehicle.model')}</th>
            <th>{t('catalog.description')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id}>
              <td>{v.plateNumber}</td>
              <td>{v.brand}</td>
              <td>{v.model}</td>
              <td>{v.description ?? '–'}</td>
              <td>
                <button type="button" className={styles.smallBtnEdit} onClick={() => { setEditing(v); setForm({ plateNumber: v.plateNumber, brand: v.brand, model: v.model, description: v.description ?? '' }); }}>{t('common.edit')}</button>
                <button type="button" className={styles.smallBtnDanger} onClick={() => store.deleteVehicle(v.id)}>{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {vehicles.length === 0 && !showForm && <p className={styles.noData}>{t('common.noData')}</p>}
    </Card>
  );
}
