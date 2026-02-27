import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { TeamsTab } from '../components/management/TeamsTab';
import { VehiclesTab } from '../components/management/VehiclesTab';
import { MaterialsTab } from '../components/management/MaterialsTab';
import { EquipmentTab } from '../components/management/EquipmentTab';
import { WorkItemsTab } from '../components/management/WorkItemsTab';
import { UsersTab } from '../components/management/UsersTab';
import styles from './Management.module.css';

type TabId = 'teams' | 'vehicles' | 'materials' | 'equipment' | 'workItems' | 'users';

export function Management() {
  const { t } = useI18n();
  const { user } = useApp();
  const [tab, setTab] = useState<TabId>('teams');

  const canEditCatalog = user?.role === 'companyManager' || user?.role === 'projectManager';

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'teams', label: t('nav.teams'), show: true },
    { id: 'vehicles', label: t('vehicle.title'), show: canEditCatalog },
    { id: 'materials', label: t('catalog.materials'), show: true },
    { id: 'equipment', label: t('catalog.equipment'), show: canEditCatalog },
    { id: 'workItems', label: t('catalog.workItems'), show: canEditCatalog },
    { id: 'users', label: t('nav.users'), show: user?.role === 'companyManager' || user?.role === 'projectManager' },
  ].filter((x) => x.show);

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('topBar.managementPanel')}</h1>
      <div className={styles.tabList}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? styles.tabActive : styles.tab}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.tabPanel}>
        {tab === 'teams' && <TeamsTab />}
        {tab === 'vehicles' && <VehiclesTab />}
        {tab === 'materials' && <MaterialsTab />}
        {tab === 'equipment' && <EquipmentTab />}
        {tab === 'workItems' && <WorkItemsTab />}
        {tab === 'users' && <UsersTab />}
      </div>
    </div>
  );
}
