import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { Card } from '../components/ui/Card';
import type { DeliveryNote, DeliveryNoteItem, MaterialMainType } from '../types';
import styles from './DeliveryNotes.module.css';

const TYPE_DISPLAY_KEYS: Record<MaterialMainType, string> = {
  direk: 'materials.typeDisplayDirek',
  kablo_ic: 'materials.typeDisplayKabloIc',
  kablo_yeraltı: 'materials.typeDisplayKabloYeralti',
  kablo_havai: 'materials.typeDisplayKabloHavai',
  boru: 'materials.typeDisplayBoru',
  fiber_bina_kutusu: 'materials.typeDisplayFiberKutusu',
  ofsd: 'materials.typeDisplayOFSD',
  sonlandirma_paneli: 'materials.typeDisplaySonlandirmaPaneli',
  daire_sonlandirma_kutusu: 'materials.typeDisplayDaireKutusu',
  menhol: 'materials.typeDisplayMenhol',
  ek_odasi: 'materials.typeDisplayEkOdasi',
  koruyucu_fider_borusu: 'materials.typeDisplayKoruyucuFider',
  custom: 'materials.typeDisplayCustom',
};

function isMeterType(mainType: MaterialMainType): boolean {
  return mainType === 'boru' || mainType === 'kablo_ic' || mainType === 'kablo_yeraltı' || mainType === 'kablo_havai';
}

function isCableType(mainType: MaterialMainType): boolean {
  return mainType === 'kablo_ic' || mainType === 'kablo_yeraltı' || mainType === 'kablo_havai';
}

export type LineItem = {
  mainType: MaterialMainType;
  name: string;
  sizeOrCapacity: string;
  capacityLabel: string;
  quantity: number;
  spoolId: string;
  customGroupName: string;
};

const emptyLine: LineItem = {
  mainType: 'direk',
  name: '',
  sizeOrCapacity: '',
  capacityLabel: '',
  quantity: 0,
  spoolId: '',
  customGroupName: '',
};

export function DeliveryNotes() {
  const { t } = useI18n();
  const { user } = useApp();
  const companyId = user?.companyId ?? '';
  const canAccess = user?.role === 'companyManager' || user?.role === 'projectManager';

  const notes = store.getDeliveryNotes(companyId);
  const stockItems = store.getMaterialStock(companyId);
  const users = store.getUsers(companyId);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    supplier: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    irsaliyeNo: '',
  });
  const [lines, setLines] = useState<LineItem[]>([{ ...emptyLine }]);
  const [submitError, setSubmitError] = useState('');

  const selectedNote = selectedNoteId ? store.getDeliveryNote(selectedNoteId) : null;
  const noteItems = selectedNoteId ? store.getDeliveryNoteItems(selectedNoteId) : [];
  const receivedByName = selectedNote?.receivedBy
    ? users.find((u) => u.id === selectedNote.receivedBy)?.fullName ?? selectedNote.receivedBy
    : null;

  const getMaterialLabel = (materialStockItemId: string): string => {
    const m = stockItems.find((x) => x.id === materialStockItemId);
    if (!m) return '–';
    const typeLabel = t(TYPE_DISPLAY_KEYS[m.mainType]);
    const namePart = m.spoolId ? `${m.name ?? m.capacityLabel} (${m.spoolId})` : (m.name ?? m.sizeOrCapacity ?? m.capacityLabel ?? m.id);
    return `${typeLabel} — ${namePart}`;
  };

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('deliveryNotes.title')}</h1>
        <p className={styles.muted}>{t('deliveryNotes.accessRestricted')}</p>
      </div>
    );
  }

  if (selectedNote) {
    return (
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setSelectedNoteId(null)}>
            {t('deliveryNotes.backToList')}
          </button>
        </div>
        <h1 className={styles.pageTitle}>{t('deliveryNotes.detailTitle')}</h1>
        <Card>
          <div className={styles.detailSection}>
            <dl className={styles.detailList}>
              <dt>{t('deliveryNotes.irsaliyeNo')}</dt>
              <dd>{selectedNote.irsaliyeNo}</dd>
              <dt>{t('deliveryNotes.supplier')}</dt>
              <dd>{selectedNote.supplier}</dd>
              <dt>{t('deliveryNotes.receivedDate')}</dt>
              <dd>{new Date(selectedNote.receivedDate).toLocaleDateString()}</dd>
              {receivedByName && (
                <>
                  <dt>{t('deliveryNotes.receivedBy')}</dt>
                  <dd>{receivedByName}</dd>
                </>
              )}
            </dl>
          </div>
          <h3 className={styles.sectionTitle} style={{ marginTop: '1rem' }}>{t('deliveryNotes.lineItems')}</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('deliveryNotes.material')}</th>
                <th>{t('deliveryNotes.quantity')}</th>
                <th>{t('deliveryNotes.unit')}</th>
              </tr>
            </thead>
            <tbody>
              {noteItems.length === 0 && (
                <tr><td colSpan={3} className={styles.muted}>{t('common.noData')}</td></tr>
              )}
              {noteItems.map((item: DeliveryNoteItem) => (
                <tr key={item.id}>
                  <td>{getMaterialLabel(item.materialStockItemId)}</td>
                  <td>{item.quantity}</td>
                  <td>{item.quantityUnit === 'm' ? 'm' : t('jobs.material.pcs')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  const handleAddLine = () => {
    setLines((prev) => [...prev, { ...emptyLine }]);
  };

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, patch: Partial<LineItem>) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      if (patch.mainType !== undefined) {
        next[index].quantity = next[index].quantity || (isMeterType(patch.mainType) ? 1 : 1);
      }
      return next;
    });
  };

  const validateLine = (line: LineItem): string | null => {
    const name = line.name.trim();
    const size = line.sizeOrCapacity.trim();
    const cap = line.capacityLabel.trim();
    const spool = line.spoolId.trim();
    const custom = line.customGroupName.trim();
    if (line.mainType === 'direk' || line.mainType === 'boru') {
      if (!name || !size) return 'validation.required';
    }
    if (isCableType(line.mainType)) {
      if (!cap || !spool) return 'validation.required';
    }
    if (['fiber_bina_kutusu', 'ofsd', 'sonlandirma_paneli', 'daire_sonlandirma_kutusu', 'menhol', 'ek_odasi', 'koruyucu_fider_borusu'].includes(line.mainType)) {
      if (!name) return 'validation.required';
    }
    if (line.mainType === 'custom') {
      if (!custom || !name) return 'validation.required';
    }
    if (line.quantity <= 0) return 'validation.positiveNumber';
    return null;
  };

  const handleSubmitReceive = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!form.irsaliyeNo.trim()) {
      setSubmitError('deliveryNotes.irsaliyeNoRequired');
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const err = validateLine(lines[i]);
      if (err) {
        setSubmitError(err);
        return;
      }
    }
    const validLines = lines.filter((l) => l.quantity > 0);
    if (validLines.length === 0) {
      setSubmitError('deliveryNotes.atLeastOneLine');
      return;
    }
    const { note } = store.receiveDeliveryNote(companyId, {
      supplier: form.supplier.trim() || '-',
      receivedDate: form.receivedDate,
      irsaliyeNo: form.irsaliyeNo.trim(),
      receivedBy: user?.id,
      items: validLines.map((l) => ({
        mainType: l.mainType,
        name: l.name.trim() || undefined,
        sizeOrCapacity: l.sizeOrCapacity.trim() || undefined,
        capacityLabel: l.capacityLabel.trim() || undefined,
        quantity: Math.floor(Number(l.quantity) || 0),
        quantityUnit: isMeterType(l.mainType) ? 'm' : 'pcs',
        spoolId: l.spoolId.trim() || undefined,
        customGroupName: l.customGroupName.trim() || undefined,
      })),
    });
    setForm({ supplier: '', receivedDate: new Date().toISOString().slice(0, 10), irsaliyeNo: '' });
    setLines([{ ...emptyLine }]);
    setShowForm(false);
    setSelectedNoteId(note.id);
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>{t('deliveryNotes.title')}</h1>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => { setShowForm(!showForm); setSubmitError(''); }}
        >
          {showForm ? t('common.cancel') : t('deliveryNotes.newDeliveryNote')}
        </button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmitReceive} className={styles.form}>
            <label className={styles.label}>
              {t('deliveryNotes.irsaliyeNo')}
              <input
                value={form.irsaliyeNo}
                onChange={(e) => setForm((f) => ({ ...f, irsaliyeNo: e.target.value }))}
                className={styles.input}
                placeholder="e.g. IRS-2026-001"
                required
              />
            </label>
            <label className={styles.label}>
              {t('deliveryNotes.supplier')}
              <input
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                className={styles.input}
                placeholder={t('deliveryNotes.supplierPlaceholder')}
              />
            </label>
            <label className={styles.label}>
              {t('deliveryNotes.receivedDate')}
              <input
                type="date"
                value={form.receivedDate}
                onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))}
                className={styles.input}
                required
              />
            </label>
            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>{t('deliveryNotes.lineItems')}</h4>
            <p className={styles.muted} style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
              {t('deliveryNotes.lineItemsHint')}
            </p>
            {lines.map((line, index) => (
              <div key={index} className={styles.lineRow}>
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 100 }}>
                  {t('materials.mainTypeLabel')}
                  <select
                    value={line.mainType}
                    onChange={(e) => handleLineChange(index, { mainType: e.target.value as MaterialMainType })}
                    className={styles.input}
                  >
                    {Object.entries(TYPE_DISPLAY_KEYS).map(([val, key]) => (
                      <option key={val} value={val}>{t(key)}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 100 }}>
                  {line.mainType === 'custom' ? t('materials.customTypeName') : t('materials.tableNameDesc')}
                  <input
                    className={styles.input}
                    value={line.name}
                    onChange={(e) => handleLineChange(index, { name: e.target.value })}
                    placeholder={line.mainType === 'custom' ? t('materials.customPlaceholder') : ''}
                  />
                </label>
                {(line.mainType === 'direk' || line.mainType === 'boru' || ['fiber_bina_kutusu', 'ofsd', 'sonlandirma_paneli', 'daire_sonlandirma_kutusu'].includes(line.mainType)) && (
                  <label className={styles.label} style={{ marginBottom: 0, minWidth: 80 }}>
                    {line.mainType === 'direk' ? t('materials.sizeOrLengthDirek') : line.mainType === 'boru' ? t('materials.sizeOrLengthBoru') : t('materials.capacityExample')}
                    <input
                      className={styles.input}
                      value={line.sizeOrCapacity}
                      onChange={(e) => handleLineChange(index, { sizeOrCapacity: e.target.value })}
                    />
                  </label>
                )}
                {isCableType(line.mainType) && (
                  <>
                    <label className={styles.label} style={{ marginBottom: 0, minWidth: 70 }}>
                      {line.mainType === 'kablo_ic' ? t('materials.cableCapacityIc') : line.mainType === 'kablo_yeraltı' ? t('materials.cableCapacityYeralti') : t('materials.cableCapacityHavai')}
                      <input
                        className={styles.input}
                        value={line.capacityLabel}
                        onChange={(e) => handleLineChange(index, { capacityLabel: e.target.value })}
                      />
                    </label>
                    <label className={styles.label} style={{ marginBottom: 0, minWidth: 70 }}>
                      {t('materials.spoolId')}
                      <input
                        className={styles.input}
                        value={line.spoolId}
                        onChange={(e) => handleLineChange(index, { spoolId: e.target.value })}
                      />
                    </label>
                  </>
                )}
                {line.mainType === 'custom' && (
                  <label className={styles.label} style={{ marginBottom: 0, minWidth: 80 }}>
                    {t('materials.sizeCapacity')}
                    <input
                      className={styles.input}
                      value={line.sizeOrCapacity}
                      onChange={(e) => handleLineChange(index, { sizeOrCapacity: e.target.value })}
                    />
                  </label>
                )}
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 70 }}>
                  {isMeterType(line.mainType) ? t('materials.quantityMeters') : t('materials.stockQtyPcs')}
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className={styles.input}
                    value={line.quantity || ''}
                    onChange={(e) => handleLineChange(index, { quantity: Math.floor(Number(e.target.value) || 0) })}
                    placeholder="0"
                  />
                </label>
                <span className={styles.muted} style={{ alignSelf: 'center' }}>
                  {isMeterType(line.mainType) ? ' m' : ` ${t('jobs.material.pcs')}`}
                </span>
                {lines.length > 1 && (
                  <button type="button" className={styles.removeLineBtn} onClick={() => handleRemoveLine(index)}>
                    {t('common.delete')}
                  </button>
                )}
              </div>
            ))}
            <button type="button" className={styles.addLineBtn} onClick={handleAddLine}>
              + {t('deliveryNotes.addLine')}
            </button>
            {submitError && <p className={styles.error}>{t(submitError)}</p>}
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>{t('deliveryNotes.receive')}</button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('deliveryNotes.irsaliyeNo')}</th>
              <th>{t('deliveryNotes.supplier')}</th>
              <th>{t('deliveryNotes.receivedDate')}</th>
              <th>{t('deliveryNotes.receivedBy')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 && !showForm && (
              <tr><td colSpan={5} className={styles.muted}>{t('common.noData')}</td></tr>
            )}
            {notes.map((note: DeliveryNote) => {
              const name = note.receivedBy ? users.find((u) => u.id === note.receivedBy)?.fullName ?? note.receivedBy : '–';
              return (
                <tr key={note.id}>
                  <td>{note.irsaliyeNo}</td>
                  <td>{note.supplier}</td>
                  <td>{new Date(note.receivedDate).toLocaleDateString()}</td>
                  <td>{name}</td>
                  <td>
                    <button type="button" className={styles.linkBtn} onClick={() => setSelectedNoteId(note.id)}>
                      {t('deliveryNotes.viewDetail')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
