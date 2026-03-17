/**
 * Notifications stored in Supabase so CM/PM see them on any device (and optional voice when they open the app).
 */

import { supabase } from './supabaseClient';
import type { NotificationType } from '../types';

export type SupabaseNotificationRow = {
  id: string;
  company_id: string;
  type: string;
  title_key: string;
  meta: Record<string, string>;
  created_at: string;
  read_at: string | null;
};

/**
 * Push a notification to Supabase. Call when e.g. a team is created so CM/PM see it on any device.
 */
export async function pushNotificationToSupabase(
  companyId: string,
  type: NotificationType,
  titleKey: string,
  meta: Record<string, string>
): Promise<void> {
  if (!supabase || !companyId) return;
  await supabase.from('notifications').insert({
    company_id: companyId,
    type,
    title_key: titleKey,
    meta: meta ?? {},
  });
}

/**
 * Fetch notifications for this company; read_at is set for the current user if they marked it read.
 * Returns rows with read_at from notification_reads for userId.
 */
export async function fetchNotificationsFromSupabase(
  companyId: string,
  userId: string
): Promise<SupabaseNotificationRow[]> {
  if (!supabase || !companyId || !userId) return [];
  const { data: rows } = await supabase
    .from('notifications')
    .select('id, company_id, type, title_key, meta, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (!rows || rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: reads } = await supabase
    .from('notification_reads')
    .select('notification_id, read_at')
    .eq('user_id', userId)
    .in('notification_id', ids);
  const readMap = new Map<string, string>();
  (reads ?? []).forEach((r: { notification_id: string; read_at: string }) => {
    readMap.set(r.notification_id, r.read_at);
  });
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    type: r.type as string,
    title_key: r.title_key as string,
    meta: (r.meta as Record<string, string>) ?? {},
    created_at: r.created_at as string,
    read_at: readMap.get(r.id as string) ?? null,
  }));
}

/**
 * Mark a notification as read for the current user in Supabase.
 */
export async function markNotificationReadInSupabase(
  notificationId: string,
  userId: string
): Promise<void> {
  if (!supabase || !notificationId || !userId) return;
  await supabase.from('notification_reads').upsert(
    { notification_id: notificationId, user_id: userId, read_at: new Date().toISOString() },
    { onConflict: 'notification_id,user_id' }
  );
}

/**
 * Mark all notifications for this company as read for the current user.
 */
export async function markAllNotificationsReadInSupabase(
  companyId: string,
  userId: string
): Promise<void> {
  const client = supabase;
  if (!client || !companyId || !userId) return;
  const { data: rows } = await client
    .from('notifications')
    .select('id')
    .eq('company_id', companyId);
  if (!rows || rows.length === 0) return;
  const now = new Date().toISOString();
  await Promise.all(
    rows.map((r: { id: string }) =>
      client.from('notification_reads').upsert(
        { notification_id: r.id, user_id: userId, read_at: now },
        { onConflict: 'notification_id,user_id' }
      )
    )
  );
}
