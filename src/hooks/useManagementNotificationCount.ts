import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  getActivityUnreadCount,
  markAllActivityAsRead,
  subscribeActivityNotifications,
} from '../services/activityNotificationService';
import {
  fetchNotificationsFromSupabase,
  markAllNotificationsReadInSupabase,
  type SupabaseNotificationRow,
} from '../services/supabaseNotificationService';

/**
 * Şirket yöneticisi / PM için “yönetim bildirimi” sayısı (eski zil).
 * /management altına ilk girişte okundu işaretlenir; rozet sıfırlanır.
 */
export function useManagementNotificationCount(): number {
  const { user } = useApp();
  const location = useLocation();
  const companyId = user?.companyId ?? '';
  const userId = user?.id ?? '';
  const isCompanyManager = user?.role === 'companyManager';
  const isManager = user?.role === 'companyManager' || user?.role === 'projectManager';

  const [supabaseList, setSupabaseList] = useState<SupabaseNotificationRow[]>([]);
  const [, activityTick] = useState(0);
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isCompanyManager) return;
    return subscribeActivityNotifications(() => activityTick((n) => n + 1));
  }, [isCompanyManager]);

  useEffect(() => {
    if (!isManager || !companyId || !userId) {
      setSupabaseList([]);
      return;
    }
    fetchNotificationsFromSupabase(companyId, userId).then(setSupabaseList);
  }, [isManager, companyId, userId]);

  useEffect(() => {
    const prev = prevPathRef.current;
    const path = location.pathname;
    const nowInManagement = path.startsWith('/management');
    const wasInManagement = prev !== null && prev.startsWith('/management');
    prevPathRef.current = path;

    if (!nowInManagement || wasInManagement) return;
    if (!companyId || !userId || !isManager) return;

    if (isCompanyManager) markAllActivityAsRead(companyId);
    void markAllNotificationsReadInSupabase(companyId, userId).then(() =>
      fetchNotificationsFromSupabase(companyId, userId).then(setSupabaseList)
    );
    activityTick((n) => n + 1);
  }, [location.pathname, companyId, userId, isManager, isCompanyManager]);

  const activityUnread = isCompanyManager ? getActivityUnreadCount(companyId) : 0;
  const supabaseUnread = supabaseList.filter((n) => !n.read_at).length;
  return activityUnread + supabaseUnread;
}
