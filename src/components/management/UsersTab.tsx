import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useApp } from '../../context/AppContext';
import { store } from '../../data/store';
import { authService } from '../../services/authService';
import { ensurePendingUserNotifications } from '../../services/activityNotificationService';
import { canPlanAddUser } from '../../services/planGating';
import { getEffectivePlan } from '../../services/subscriptionService';
import { Card } from '../ui/Card';
import type { User as UserType, Role } from '../../types';
import styles from './ManagementTabs.module.css';

const roleKeys: Record<string, string> = {
  companyManager: 'roles.companyManager',
  projectManager: 'roles.projectManager',
  teamLeader: 'roles.teamLeader',
};

type JoinRequestRow = { id: string; user_id: string; full_name: string | null; email: string | null };

export function UsersTab() {
  const { t } = useI18n();
  const { user: currentUser, company, refreshUser } = useApp();
  const companyId = currentUser?.companyId ?? '';
  const [, setProfilesFetched] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [limitError, setLimitError] = useState('');
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);
  const users = store.getUsers(companyId);
  const pending = users.filter((u) => u.roleApprovalStatus === 'pending');
  const canAddMoreUsers = canPlanAddUser(getEffectivePlan(company), users.length);
  const hasCompanyManager = users.some((u) => u.role === 'companyManager');
  const assignableRoles: Role[] = hasCompanyManager ? ['projectManager', 'teamLeader'] : ['companyManager', 'projectManager', 'teamLeader'];

  const loadJoinRequests = useCallback(async () => {
    if (!companyId) return;
    const list = await authService.fetchJoinRequestsWithProfiles(companyId);
    setJoinRequests(list);
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !currentUser) return;
    const isCMorPM = currentUser.role === 'companyManager' || currentUser.role === 'projectManager';
    if (isCMorPM) {
      authService.fetchCompanyProfilesIntoStore(companyId).then(() => {
        setProfilesFetched(true);
        const all = store.getUsers(companyId);
        const pending = all.filter((u) => u.roleApprovalStatus === 'pending');
        ensurePendingUserNotifications(companyId, pending.map((u) => ({ id: u.id, fullName: u.fullName ?? null })));
      });
    }
    if (currentUser.role === 'companyManager') {
      loadJoinRequests();
    }
  }, [companyId, currentUser?.role, loadJoinRequests]);

  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<Role>('teamLeader');
  const [approvingReqId, setApprovingReqId] = useState<string | null>(null);
  const [joinReqRole, setJoinReqRole] = useState<Role>('teamLeader');

  const isCompanyManager = currentUser?.role === 'companyManager';
  /** Only company manager can grant/revoke price visibility (price limit) for team leaders. */
  const canGrantPriceVisibility = currentUser?.role === 'companyManager';

  const handleGrantPriceVisibility = async (tl: UserType) => {
    if (tl.role !== 'teamLeader' || !canGrantPriceVisibility) return;
    const ok = await authService.updateUserCanSeePrices(tl.id, true);
    if (ok) {
      store.updateUser(tl.id, { canSeePrices: true });
      setUsersRefreshKey((k) => k + 1);
    }
  };
  const handleRevokePriceVisibility = async (tl: UserType) => {
    if (tl.role !== 'teamLeader' || !canGrantPriceVisibility) return;
    const ok = await authService.updateUserCanSeePrices(tl.id, false);
    if (ok) {
      store.updateUser(tl.id, { canSeePrices: false });
      setUsersRefreshKey((k) => k + 1);
    }
  };

  const handleApproveWithRole = (userId: string) => {
    const roleToUse = assignableRoles.includes(approveRole) ? approveRole : assignableRoles[0];
    const ok = authService.approveUser(userId, roleToUse);
    if (ok) {
      setApprovingUserId(null);
    }
  };

  const handleReject = (userId: string) => {
    authService.rejectUser(userId);
    setApprovingUserId(null);
  };

  const handleApproveJoinRequest = async (reqId: string) => {
    setLimitError('');
    if (!canPlanAddUser(getEffectivePlan(company), users.length)) {
      setLimitError(t('onboarding.userLimitReached'));
      return;
    }
    const roleToUse = assignableRoles.includes(joinReqRole) ? joinReqRole : assignableRoles[0];
    const ok = await authService.approveJoinRequest(reqId, roleToUse);
    if (ok) {
      setApprovingReqId(null);
      await authService.fetchCompanyProfilesIntoStore(companyId);
      refreshUser();
      loadJoinRequests();
    }
  };

  const handleRejectJoinRequest = async (reqId: string) => {
    const ok = await authService.rejectJoinRequest(reqId);
    if (ok) loadJoinRequests();
  };

  return (
    <>
      {!canAddMoreUsers && users.length > 0 && (
        <p className={styles.errorText}>{t('onboarding.userLimitReached')}</p>
      )}
      {limitError && <p className={styles.errorText}>{limitError}</p>}
      {isCompanyManager && joinRequests.length > 0 && (
        <Card title={t('joinRequests.title')}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('auth.fullName')}</th>
                <th>{t('auth.email')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {joinRequests.map((req) => (
                <tr key={req.id}>
                  <td>{req.full_name ?? '–'}</td>
                  <td>{req.email ?? '–'}</td>
                  <td>
                    {approvingReqId === req.id ? (
                      <>
                        <select
                          value={assignableRoles.includes(joinReqRole) ? joinReqRole : assignableRoles[0]}
                          onChange={(e) => setJoinReqRole(e.target.value as Role)}
                          className={styles.input}
                          style={{ width: 'auto', marginRight: '0.5rem', marginBottom: 0 }}
                        >
                          {assignableRoles.map((r) => (
                            <option key={r} value={r}>{t(roleKeys[r])}</option>
                          ))}
                        </select>
                        <button type="button" className={styles.smallBtnOk} onClick={() => handleApproveJoinRequest(req.id)} disabled={!canAddMoreUsers}>
                          {t('joinRequests.approve')}
                        </button>
                        <button type="button" className={styles.smallBtnDanger} onClick={() => setApprovingReqId(null)}>
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={styles.smallBtnOk} onClick={() => setApprovingReqId(req.id)} disabled={!canAddMoreUsers}>
                          {t('joinRequests.approve')}
                        </button>
                        <button type="button" className={styles.smallBtnDanger} onClick={() => handleRejectJoinRequest(req.id)}>
                          {t('joinRequests.reject')}
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
                          value={assignableRoles.includes(approveRole) ? approveRole : assignableRoles[0]}
                          onChange={(e) => setApproveRole(e.target.value as Role)}
                          className={styles.input}
                          style={{ width: 'auto', marginRight: '0.5rem', marginBottom: 0 }}
                        >
                          {assignableRoles.map((r) => (
                            <option key={r} value={r}>{t(roleKeys[r])}</option>
                          ))}
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
