import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { authService } from '../../services/authService';
import { Card } from '../ui/Card';
import type { User as UserType } from '../../types';
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

  const canApprovePM = currentUser?.role === 'companyManager';
  const canApproveTL = currentUser?.role === 'companyManager' || currentUser?.role === 'projectManager';
  const canGrantPriceVisibility = currentUser?.role === 'companyManager' || currentUser?.role === 'projectManager';

  const handleGrantPriceVisibility = (tl: UserType) => {
    if (tl.role !== 'teamLeader' || !canGrantPriceVisibility) return;
    store.updateUser(tl.id, { canSeePrices: true });
  };
  const handleRevokePriceVisibility = (tl: UserType) => {
    if (tl.role !== 'teamLeader' || !canGrantPriceVisibility) return;
    store.updateUser(tl.id, { canSeePrices: false });
  };

  const handleApprove = (u: UserType) => {
    if (u.role === 'projectManager' && canApprovePM) {
      authService.approveUser(u.id, 'companyManager');
    } else if (u.role === 'teamLeader' && canApproveTL) {
      authService.approveUser(u.id, currentUser!.role === 'companyManager' ? 'companyManager' : 'projectManager');
    }
  };

  const handleReject = (userId: string) => {
    authService.rejectUser(userId);
  };

  return (
    <>
      {pending.length > 0 && (
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
                  <td>{t(roleKeys[u.role])}</td>
                  <td>
                    {(u.role === 'projectManager' && canApprovePM) || (u.role === 'teamLeader' && canApproveTL) ? (
                      <>
                        <button type="button" className={styles.smallBtnOk} onClick={() => handleApprove(u)}>{t('users.approveUser')}</button>
                        <button type="button" className={styles.smallBtnDanger} onClick={() => handleReject(u.id)}>{t('users.rejectUser')}</button>
                      </>
                    ) : (
                      <span className={styles.badgePending}>{t('users.pending')}</span>
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
                <td>{t(roleKeys[u.role])}</td>
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
