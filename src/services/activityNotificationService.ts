import type { ActivityNotification, NotificationType } from '../types';

const STORAGE_KEY = 'tf_activity_notifications';

function loadAll(): ActivityNotification[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? (JSON.parse(s) as ActivityNotification[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: ActivityNotification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type Listener = () => void;
const listeners: Listener[] = [];

function notifyListeners(): void {
  listeners.forEach((cb) => cb());
}

export function subscribeActivityNotifications(cb: Listener): () => void {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i !== -1) listeners.splice(i, 1);
  };
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Remove read notifications that were read more than 24 hours ago. */
function cleanupReadOlderThan24h(list: ActivityNotification[]): ActivityNotification[] {
  const now = Date.now();
  return list.filter((n) => {
    if (!n.read || !n.readAt) return true;
    const readAt = new Date(n.readAt).getTime();
    return now - readAt <= TWENTY_FOUR_HOURS_MS;
  });
}

/** Load, cleanup read items older than 24h, save if changed. */
function loadAndClean(): ActivityNotification[] {
  let list = loadAll();
  const cleaned = cleanupReadOlderThan24h(list);
  if (cleaned.length !== list.length) {
    saveAll(cleaned);
    notifyListeners();
  }
  return cleaned;
}

/**
 * Get all activity notifications for a company (for Company Manager).
 * Read notifications are deleted 24 hours after readAt. Newest first.
 */
export function getActivityNotifications(companyId: string): ActivityNotification[] {
  const list = loadAndClean();
  return list
    .filter((n) => n.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getActivityUnreadCount(companyId: string): number {
  const list = loadAndClean();
  return list.filter((n) => n.companyId === companyId && !n.read).length;
}

export function markActivityAsRead(notificationId: string): void {
  const list = loadAll();
  const i = list.findIndex((n) => n.id === notificationId);
  if (i === -1) return;
  const now = new Date().toISOString();
  list[i] = { ...list[i], read: true, readAt: now };
  saveAll(list);
  notifyListeners();
}

export function markAllActivityAsRead(companyId: string): void {
  const now = new Date().toISOString();
  const list = loadAll().map((n) =>
    n.companyId === companyId && !n.read ? { ...n, read: true, readAt: now } : n
  );
  saveAll(list);
  notifyListeners();
}

export type AddActivityNotificationParams = {
  companyId: string;
  type: NotificationType;
  titleKey: string;
  meta: Record<string, string>;
};

/**
 * Add a notification (e.g. when PM approves job). Company Manager will see it in the notification box.
 */
export function addActivityNotification(params: AddActivityNotificationParams): ActivityNotification {
  const list = loadAll();
  const notification: ActivityNotification = {
    id: id(),
    companyId: params.companyId,
    type: params.type,
    titleKey: params.titleKey,
    meta: params.meta ?? {},
    read: false,
    createdAt: new Date().toISOString(),
  };
  list.push(notification);
  saveAll(list);
  notifyListeners();
  return notification;
}
