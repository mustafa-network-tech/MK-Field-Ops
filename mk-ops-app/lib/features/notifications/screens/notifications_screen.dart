import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../shared/widgets/app_widgets.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).valueOrNull;
    if (profile == null) return const SizedBox.shrink();

    final companyId = profile.companyId ?? '';
    final notifArgs = (companyId: companyId, userId: profile.id);
    final notifsAsync = ref.watch(notificationsProvider(notifArgs));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Bildirimler'),
        actions: [
          notifsAsync.whenOrNull(
                data: (notifs) {
                  final unread = notifs.where((n) => !n.isRead).toList();
                  if (unread.isEmpty) return null;
                  return TextButton(
                    onPressed: () async {
                      final svc = ref.read(supabaseServiceProvider);
                      for (final n in unread) {
                        await svc.markNotificationRead(n.id, profile.id);
                      }
                      ref.invalidate(notificationsProvider);
                    },
                    child: const Text('Tümünü Okundu',
                        style: TextStyle(color: AppColors.blue, fontSize: 12)),
                  );
                },
              ) ??
              const SizedBox.shrink(),
        ],
      ),
      body: notifsAsync.when(
        loading: () => const AppLoading(),
        error: (e, _) => AppError(message: e.toString()),
        data: (notifs) => notifs.isEmpty
            ? const EmptyState(
                icon: Icons.notifications_off_outlined,
                title: 'Bildirim yok',
                subtitle: 'Henüz bildirim bulunmuyor.')
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: notifs.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _NotifTile(
                    notif: notifs[i],
                    onTap: () async {
                      if (!notifs[i].isRead) {
                        await ref
                            .read(supabaseServiceProvider)
                            .markNotificationRead(notifs[i].id, profile.id);
                        ref.invalidate(notificationsProvider);
                      }
                    }),
              ),
      ),
    );
  }
}

class _NotifTile extends StatelessWidget {
  final AppNotification notif;
  final VoidCallback onTap;

  const _NotifTile({required this.notif, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isUnread = !notif.isRead;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isUnread
              ? AppColors.blue.withOpacity(0.08)
              : AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isUnread
                ? AppColors.blue.withOpacity(0.3)
                : AppColors.surfaceBorder,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _iconColor(notif.type).withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_iconData(notif.type),
                  color: _iconColor(notif.type), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(notif.displayTitle,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isUnread ? FontWeight.w700 : FontWeight.w500,
                          color: AppColors.white)),
                  const SizedBox(height: 2),
                  Text(formatDateLong(notif.createdAt),
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.gray500)),
                ],
              ),
            ),
            if (isUnread)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: const BoxDecoration(
                    color: AppColors.blue, shape: BoxShape.circle),
              ),
          ],
        ),
      ),
    );
  }

  IconData _iconData(String type) {
    switch (type) {
      case 'pm_job_approved': return Icons.check_circle_outline;
      case 'pm_team_created': return Icons.group_add_outlined;
      case 'pm_team_approved': return Icons.groups_outlined;
      case 'new_user_pending': return Icons.person_add_outlined;
      default: return Icons.notifications_outlined;
    }
  }

  Color _iconColor(String type) {
    switch (type) {
      case 'pm_job_approved': return AppColors.green;
      case 'pm_team_created': return AppColors.blue;
      case 'pm_team_approved': return AppColors.green;
      case 'new_user_pending': return AppColors.orange;
      default: return AppColors.gray400;
    }
  }
}
