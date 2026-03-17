import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { upsertEquipment } from '../../services/supabaseSyncService';
import { Card } from '../ui/Card';
import type { Equipment } from '../../types';
import styles from './ManagementTabs.module.css';

export function EquipmentTab() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const equipment = store.getEquipment(companyId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({ code: '', description: '' });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const updated = store.updateEquipment(editing.id, { code: form.code, description: form.description });
      if (updated) upsertEquipment(updated).catch(() => {});
      setEditing(null);
    } else {
      const added = store.addEquipment({ companyId, code: form.code, description: form.description });
      upsertEquipment(added).catch(() => {});
      setShowForm(false);
    }
    setForm({ code: '', description: '' });
  };

  return (
    <Card>
      <div className={styles.toolbar}>
        <h3 className={styles.sectionTitle}>{t('catalog.equipment')}</h3>
        {!editing && (
          <button type="button" className={styles.primaryBtn} onClick={() => setShowForm(!showForm)}>
            {showForm ? t('common.cancel') : t('catalog.addEquipment')}
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
            {t('catalog.description')}
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={styles.input} />
          </label>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn}>{t('common.save')}</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => { setShowForm(false); setEditing(null); setForm({ code: '', description: '' }); }}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
      <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('catalog.code')}</th>
            <th>{t('catalog.description')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {equipment.map((e) => (
            <tr key={e.id}>
              <td>{e.code}</td>
              <td>{e.description}</td>
              <td>
                <button type="button" className={styles.smallBtnEdit} onClick={() => { setEditing(e); setForm({ code: e.code, description: e.description }); }}>{t('common.edit')}</button>
                <button type="button" className={styles.smallBtnDanger} onClick={() => store.deleteEquipment(e.id)}>{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {equipment.length === 0 && !showForm && <p className={styles.noData}>{t('common.noData')}</p>}
    </Card>
  );
}
