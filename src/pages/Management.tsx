import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { canPlanAccessFeature } from '../services/planGating';
import { TeamsTab } from '../components/management/TeamsTab';
import { VehiclesTab } from '../components/management/VehiclesTab';
import { MaterialsTab } from '../components/management/MaterialsTab';
import { EquipmentTab } from '../components/management/EquipmentTab';
import { WorkItemsTab } from '../components/management/WorkItemsTab';
import { UsersTab } from '../components/management/UsersTab';
import { AuditLogTab } from '../components/management/AuditLogTab';
import { ProjectsTab } from '../components/management/ProjectsTab';
import styles from './Management.module.css';

type TabId = 'teams' | 'vehicles' | 'materials' | 'equipment' | 'workItems' | 'projects' | 'users' | 'auditLog';

export function Management() {
  const { t } = useI18n();
  const { user, company } = useApp();
  const [tab, setTab] = useState<TabId>('teams');

  const canEditCatalog = user?.role === 'companyManager' || user?.role === 'projectManager';
  const planAllowsProjects = canPlanAccessFeature(company?.plan, 'projects');
  const planAllowsMaterials = canPlanAccessFeature(company?.plan, 'materials');

  const tabs = (
    [
      { id: 'teams' as TabId, label: t('nav.teams'), show: true },
      { id: 'vehicles' as TabId, label: t('vehicle.title'), show: canEditCatalog },
      { id: 'materials' as TabId, label: t('catalog.materials'), show: planAllowsMaterials },
      { id: 'equipment' as TabId, label: t('catalog.equipment'), show: canEditCatalog },
      { id: 'workItems' as TabId, label: t('catalog.workItems'), show: canEditCatalog },
      { id: 'projects' as TabId, label: t('nav.projects'), show: canEditCatalog && planAllowsProjects },
      { id: 'users' as TabId, label: t('nav.users'), show: user?.role === 'companyManager' || user?.role === 'projectManager' },
      { id: 'auditLog' as TabId, label: t('audit.title'), show: canEditCatalog },
    ] as { id: TabId; label: string; show: boolean }[]
  ).filter((x) => x.show);

  useEffect(() => {
    const visibleIds = tabs.map((x) => x.id);
    if (tab && !visibleIds.includes(tab)) {
      setTab((visibleIds[0] as TabId) ?? 'teams');
    }
  }, [tabs, tab]);

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
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'auditLog' && <AuditLogTab />}
      </div>
    </div>
  );
}
