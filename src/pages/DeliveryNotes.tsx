import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { canPlanAccessFeature } from '../services/planGating';
import { getEffectivePlan } from '../services/subscriptionService';
import { store } from '../data/store';
import { persistDeliveryReceiveToSupabase } from '../services/supabaseSyncService';
import { Card } from '../components/ui/Card';
import type { DeliveryNote, DeliveryNoteItem } from '../types';
import styles from './DeliveryNotes.module.css';

export type LineItem = {
  materialName: string;
  materialType: string;
  materialSize: string;
  materialId: string;
  unit: '' | 'adet' | 'metre' | 'kilo' | 'metreküp';
  quantity: number;
};

const emptyLine: LineItem = {
  materialName: '',
  materialType: '',
  materialSize: '',
  materialId: '',
  unit: '',
  quantity: 0,
};

export function DeliveryNotes() {
  const { t } = useI18n();
  const { user, company } = useApp();
  const companyId = user?.companyId ?? '';
  const planAllowsDeliveryNotes = canPlanAccessFeature(getEffectivePlan(company), 'deliveryNotes');
  const canAccess = (user?.role === 'companyManager' || user?.role === 'projectManager') && planAllowsDeliveryNotes;

  if (!planAllowsDeliveryNotes) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('deliveryNotes.title')}</h1>
        <Card title={t('planUpgrade.title')}>
          <p className={styles.restrictedMessage}>{t('planUpgrade.deliveryNotes')}</p>
        </Card>
      </div>
    );
  }

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

  const getMaterialLabel = (materialStockItemId: string, detailId?: string | null): string => {
    const m = stockItems.find((x) => x.id === materialStockItemId);
    if (!m) return '–';
    const parts: string[] = [];
    if (m.name) parts.push(m.name);
    if (m.capacityLabel) parts.push(m.capacityLabel);
    if (m.sizeOrCapacity) parts.push(m.sizeOrCapacity);
    if (detailId) parts.push(detailId);
    return parts.join(' / ') || m.id;
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
          <div className={styles.tableWrap}>
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
              {noteItems.map((item: DeliveryNoteItem) => {
                const label = getMaterialLabel(item.materialStockItemId, item.materialDetailId);
                const unitLabel =
                  item.unitDisplay === 'metre'
                    ? t('deliveryNotes.unitMeter')
                    : item.unitDisplay === 'kilo'
                      ? t('deliveryNotes.unitKilo')
                      : item.unitDisplay === 'metreküp'
                        ? t('deliveryNotes.unitCubicMeter')
                        : t('deliveryNotes.unitPiece');
                return (
                  <tr key={item.id}>
                    <td>{label}</td>
                    <td>{item.quantity}</td>
                    <td>{unitLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
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
      return next;
    });
  };

  const validateLine = (line: LineItem): string | null => {
    const name = line.materialName.trim();
    if (!name) return 'validation.required';
    if (!line.unit) return 'validation.required';
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
        name: l.materialName.trim(),
        typeLabel: l.materialType.trim() || undefined,
        sizeLabel: l.materialSize.trim() || undefined,
        materialDetailId: l.materialId.trim() || undefined,
        quantity: Math.floor(Number(l.quantity) || 0),
        unit: (l.unit && ['adet', 'metre', 'kilo', 'metreküp'].includes(l.unit) ? l.unit : 'adet') as 'adet' | 'metre' | 'kilo' | 'metreküp',
      })),
    });
    setForm({ supplier: '', receivedDate: new Date().toISOString().slice(0, 10), irsaliyeNo: '' });
    setLines([{ ...emptyLine }]);
    setShowForm(false);
    setSelectedNoteId(note.id);
    void persistDeliveryReceiveToSupabase(companyId, note.id).then((r) => {
      if (!r.ok && r.error && r.error !== 'skip') {
        console.error('[MK-OPS] İrsaliye buluta yazılamadı:', r.error);
      }
    });
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
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 120 }}>
                  {t('deliveryNotes.materialNameLabel')}
                  <input
                    className={styles.input}
                    value={line.materialName}
                    onChange={(e) => handleLineChange(index, { materialName: e.target.value })}
                    placeholder={t('deliveryNotes.materialNamePlaceholder')}
                  />
                </label>
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 110 }}>
                  {t('deliveryNotes.materialTypeLabel')}
                  <input
                    className={styles.input}
                    value={line.materialType}
                    onChange={(e) => handleLineChange(index, { materialType: e.target.value })}
                    placeholder={t('deliveryNotes.materialTypePlaceholder')}
                  />
                </label>
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 110 }}>
                  {t('deliveryNotes.materialSizeLabel')}
                  <input
                    className={styles.input}
                    value={line.materialSize}
                    onChange={(e) => handleLineChange(index, { materialSize: e.target.value })}
                    placeholder={t('deliveryNotes.materialSizePlaceholder')}
                  />
                </label>
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 110 }}>
                  {t('deliveryNotes.materialIdLabel')}
                  <input
                    className={styles.input}
                    value={line.materialId}
                    onChange={(e) => handleLineChange(index, { materialId: e.target.value })}
                    placeholder={t('deliveryNotes.materialIdPlaceholder')}
                  />
                </label>
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 90 }}>
                  {t('deliveryNotes.unit')}
                  <select
                    className={styles.input}
                    value={line.unit}
                    onChange={(e) => handleLineChange(index, { unit: e.target.value as LineItem['unit'] })}
                  >
                    <option value="">{t('deliveryNotes.selectUnitPlaceholder')}</option>
                    <option value="adet">{t('deliveryNotes.unitPiece')}</option>
                    <option value="metre">{t('deliveryNotes.unitMeter')}</option>
                    <option value="kilo">{t('deliveryNotes.unitKilo')}</option>
                    <option value="metreküp">{t('deliveryNotes.unitCubicMeter')}</option>
                  </select>
                </label>
                <label className={styles.label} style={{ marginBottom: 0, minWidth: 80 }}>
                  {t('deliveryNotes.quantity')}
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
        <div className={styles.tableWrap}>
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
        </div>
      </Card>
    </div>
  );
}
