import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);

    return profileAsync.when(
      loading: () => const Scaffold(body: AppLoading(message: 'Yükleniyor...')),
      error: (e, _) => Scaffold(body: AppError(message: e.toString())),
      data: (profile) {
        if (profile == null) {
          WidgetsBinding.instance.addPostFrameCallback(
              (_) => context.go('/auth/login'));
          return const SizedBox.shrink();
        }
        return _DashboardBody(profile: profile);
      },
    );
  }
}

class _DashboardBody extends ConsumerWidget {
  final profile;
  const _DashboardBody({required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final companyId = profile.companyId as String;
    final companyAsync = ref.watch(companyProvider);
    final company = companyAsync.valueOrNull;

    final periodAsync = ref.watch(activePeriodProvider(companyId));
    final statsAsync = ref.watch(dashboardStatsProvider(profile));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Merhaba, ${profile.fullName.split(' ').first}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            Text(company?.name ?? 'MK OPS',
                style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => context.go('/notifications'),
            icon: Stack(
              children: [
                const Icon(Icons.notifications_outlined),
                statsAsync.whenOrNull(
                      data: (s) => s.unreadNotificationCount > 0
                          ? Positioned(
                              right: 0,
                              top: 0,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                    color: AppColors.red, shape: BoxShape.circle),
                              ),
                            )
                          : null,
                    ) ??
                    const SizedBox.shrink(),
              ],
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.blue,
        onRefresh: () async {
          ref.invalidate(dashboardStatsProvider);
          ref.invalidate(activePeriodProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Active period banner
              periodAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (period) => period != null
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: AppColors.blue.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: AppColors.blue.withOpacity(0.25)),
                        ),
                        child: Row(children: [
                          const Icon(Icons.calendar_month,
                              color: AppColors.blue, size: 16),
                          const SizedBox(width: 8),
                          Text(
                            'Aktif Dönem: ${formatDate(period.startDate)} – ${formatDate(period.endDate)}',
                            style: const TextStyle(
                                color: AppColors.blue,
                                fontSize: 12,
                                fontWeight: FontWeight.w600),
                          ),
                        ]),
                      )
                    : const SizedBox.shrink(),
              ),

              // Stats grid
              statsAsync.when(
                loading: () => const SizedBox(
                    height: 200, child: AppLoading()),
                error: (e, _) =>
                    AppError(message: e.toString()),
                data: (stats) => Column(children: [
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.35,
                    children: [
                      StatCard(
                        label: 'Bugünkü İşler',
                        value: stats.todayJobCount.toString(),
                        icon: Icons.work_outline,
                        color: AppColors.blue,
                        onTap: () => context.go('/jobs'),
                      ),
                      StatCard(
                        label: 'Onay Bekliyor',
                        value: stats.pendingApprovalCount.toString(),
                        icon: Icons.pending_actions_outlined,
                        color: AppColors.orange,
                        onTap: () => profile.isManager
                            ? context.go('/approvals')
                            : context.go('/jobs'),
                      ),
                      StatCard(
                        label: 'Dönem Hakedişi',
                        value: formatCurrency(stats.currentPeriodEarnings),
                        icon: Icons.account_balance_wallet_outlined,
                        color: AppColors.green,
                        onTap: () => context.go('/payroll'),
                      ),
                      StatCard(
                        label: 'Aktif Projeler',
                        value: stats.activeProjectCount.toString(),
                        icon: Icons.folder_open_outlined,
                        color: AppColors.purple,
                        onTap: () => context.go('/projects'),
                      ),
                    ],
                  ),
                ]),
              ),

              const SizedBox(height: 24),

              // Quick action
              SizedBox(
                height: 54,
                child: ElevatedButton.icon(
                  onPressed: () => context.go('/job-entry'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.blue,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.add, size: 22),
                  label: const Text('Yeni İş Gir',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700)),
                ),
              ),

              const SizedBox(height: 24),

              // Manager shortcuts
              if (profile.isManager) ...[
                SectionHeader(
                  title: 'Yönetim',
                  actionLabel: null,
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: _ShortcutCard(
                      icon: Icons.check_circle_outline,
                      label: 'Onaylar',
                      color: AppColors.orange,
                      onTap: () => context.go('/approvals'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ShortcutCard(
                      icon: Icons.groups_outlined,
                      label: 'Ekipler',
                      color: AppColors.blue,
                      onTap: () => context.go('/teams'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ShortcutCard(
                      icon: Icons.summarize_outlined,
                      label: 'Raporlar',
                      color: AppColors.purple,
                      onTap: () => context.go('/reports'),
                    ),
                  ),
                ]),
                const SizedBox(height: 24),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ShortcutCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ShortcutCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(children: [
          Icon(icon, color: color, size: 26),
          const SizedBox(height: 6),
          Text(label,
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: color)),
        ]),
      ),
    );
  }
}
