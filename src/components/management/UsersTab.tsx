import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { authService } from '../../services/authService';
import { Card } from '../ui/Card';
import type { User as UserType, Role } from '../../types';
import styles from './ManagementTabs.module.css';

const roleKeys: Record<string, string> = {
  companyManager: 'roles.companyManager',
  projectManager: 'roles.projectManager',
  teamLeader: 'roles.teamLeader',
};

export function UsersTab() {
  const { t } = useI18n();
  const { user: currentUser } = useApp();
  const companyId = currentUser?.companyId ?? '';
  const users = store.getUsers(companyId);
  const pending = users.filter((u) => u.roleApprovalStatus === 'pending');
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<Role>('teamLeader');

  const isCompanyManager = currentUser?.role === 'companyManager';
  const canGrantPriceVisibility = currentUser?.role === 'companyManager' || currentUser?.role === 'projectManager';

  const handleGrantPriceVisibility = (tl: UserType) => {
    if (tl.role !== 'teamLeader' || !canGrantPriceVisibility) return;
    store.updateUser(tl.id, { canSeePrices: true });
  };
  const handleRevokePriceVisibility = (tl: UserType) => {
    if (tl.role !== 'teamLeader' || !canGrantPriceVisibility) return;
    store.updateUser(tl.id, { canSeePrices: false });
  };

  const handleApproveWithRole = (userId: string) => {
    const ok = authService.approveUser(userId, approveRole);
    if (ok) {
      setApprovingUserId(null);
    }
  };

  const handleReject = (userId: string) => {
    authService.rejectUser(userId);
    setApprovingUserId(null);
  };

  return (
    <>
      {isCompanyManager && pending.length > 0 && (
        <Card title={t('users.pendingApprovals')}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('auth.fullName')}</th>
                <th>{t('auth.email')}</th>
                <th>{t('auth.role')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.role ? t(roleKeys[u.role]) : t('users.roleToBeAssigned')}</td>
                  <td>
                    {approvingUserId === u.id ? (
                      <>
                        <select
                          value={approveRole}
                          onChange={(e) => setApproveRole(e.target.value as Role)}
                          className={styles.input}
                          style={{ width: 'auto', marginRight: '0.5rem', marginBottom: 0 }}
                        >
                          <option value="companyManager">{t('roles.companyManager')}</option>
                          <option value="projectManager">{t('roles.projectManager')}</option>
                          <option value="teamLeader">{t('roles.teamLeader')}</option>
                        </select>
                        <button type="button" className={styles.smallBtnOk} onClick={() => handleApproveWithRole(u.id)}>
                          {t('users.approveUser')}
                        </button>
                        <button type="button" className={styles.smallBtnDanger} onClick={() => setApprovingUserId(null)}>
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={styles.smallBtnOk} onClick={() => setApprovingUserId(u.id)}>
                          {t('users.approveUser')}
                        </button>
                        <button type="button" className={styles.smallBtnDanger} onClick={() => handleReject(u.id)}>
                          {t('users.rejectUser')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Card title={t('nav.users')}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('auth.fullName')}</th>
              <th>{t('auth.email')}</th>
              <th>{t('auth.role')}</th>
              <th>{t('jobs.status')}</th>
              {canGrantPriceVisibility && <th>{t('users.priceVisibility')}</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td>
                <td>{u.email}</td>
                <td>{u.role ? t(roleKeys[u.role]) : '–'}</td>
                <td>
                  {u.roleApprovalStatus === 'approved' && <span className={styles.badgeOk}>{t('users.active')}</span>}
                  {u.roleApprovalStatus === 'pending' && <span className={styles.badgePending}>{t('users.pending')}</span>}
                  {u.roleApprovalStatus === 'rejected' && <span className={styles.badgeReject}>{t('jobs.rejected')}</span>}
                </td>
                {canGrantPriceVisibility && (
                  <td>
                    {u.role === 'teamLeader' ? (
                      u.canSeePrices ? (
                        <button type="button" className={styles.smallBtnDanger} onClick={() => handleRevokePriceVisibility(u)}>{t('users.revokePriceVisibility')}</button>
                      ) : (
                        <button type="button" className={styles.smallBtnOk} onClick={() => handleGrantPriceVisibility(u)}>{t('users.grantPriceVisibility')}</button>
                      )
                    ) : (
                      '–'
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className={styles.noData}>{t('common.noData')}</p>}
      </Card>
    </>
  );
}
