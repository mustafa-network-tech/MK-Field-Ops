import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_widgets.dart';
import '../../../core/constants/app_constants.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    final companyAsync = ref.watch(companyProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Profil')),
      body: profileAsync.when(
        loading: () => const AppLoading(),
        error: (e, _) => AppError(message: e.toString()),
        data: (profile) {
          if (profile == null) return const SizedBox.shrink();
          final company = companyAsync.valueOrNull;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Avatar & name
                Center(
                  child: Column(children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: AppColors.blue.withOpacity(0.15),
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: AppColors.blue.withOpacity(0.3), width: 2),
                      ),
                      child: Center(
                        child: Text(
                          profile.fullName.isNotEmpty
                              ? profile.fullName[0].toUpperCase()
                              : 'U',
                          style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              color: AppColors.blue),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(profile.fullName,
                        style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: AppColors.white)),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.blue.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Text(profile.roleLabel,
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.blue)),
                    ),
                  ]),
                ),
                const SizedBox(height: 28),

                // Info cards
                _InfoCard(children: [
                  _InfoRow(Icons.email_outlined, 'E-posta', profile.email ?? '—'),
                  _InfoRow(Icons.business_outlined, 'Şirket', company?.name ?? '—'),
                  _InfoRow(
                      Icons.workspace_premium_outlined,
                      'Plan',
                      company?.plan?.toUpperCase() ?? '—'),
                  _InfoRow(
                      Icons.visibility_outlined,
                      'Fiyat Görünürlüğü',
                      profile.canSeePrices ? 'Açık' : 'Kapalı'),
                ]),
                const SizedBox(height: 12),

                // Subscription status
                if (company != null)
                  _InfoCard(children: [
                    _InfoRow(
                      Icons.check_circle_outline,
                      'Hesap Durumu',
                      company.isActive
                          ? 'Aktif'
                          : company.isSuspended
                              ? 'Askıya Alındı'
                              : 'Kapalı',
                    ),
                    if (company.planEndDate != null)
                      _InfoRow(
                          Icons.calendar_today_outlined,
                          'Lisans Bitiş',
                          formatDate(company.planEndDate!)),
                  ]),
                const SizedBox(height: 24),

                // Sign out
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (_) => AlertDialog(
                          title: const Text('Çıkış Yap'),
                          content: const Text('Hesabınızdan çıkış yapmak istiyor musunuz?'),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.pop(context, false),
                                child: const Text('İptal')),
                            TextButton(
                                onPressed: () => Navigator.pop(context, true),
                                child: const Text('Çıkış Yap',
                                    style: TextStyle(color: AppColors.red))),
                          ],
                        ),
                      );
                      if (confirm == true) {
                        await ref.read(supabaseServiceProvider).signOut();
                        // rootNavigatorKey üzerinden güvenli yönlendirme
                        final ctx = rootNavigatorKey.currentContext;
                        if (ctx != null) {
                          GoRouter.of(ctx).go('/auth/login');
                        }
                      }
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.red,
                      side: const BorderSide(color: AppColors.red),
                    ),
                    icon: const Icon(Icons.logout, size: 20),
                    label: const Text('Çıkış Yap',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(height: 16),

                // App version
                const Text('MK OPS v1.0.0',
                    style: TextStyle(fontSize: 11, color: AppColors.gray600)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.surfaceBorder),
        ),
        child: Column(
          children: children
              .expand((w) => [w, if (w != children.last) const Divider(height: 16)])
              .toList(),
        ),
      );
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) => Row(children: [
        Icon(icon, size: 16, color: AppColors.gray500),
        const SizedBox(width: 10),
        Text(label,
            style: const TextStyle(fontSize: 13, color: AppColors.gray400)),
        const Spacer(),
        Text(value,
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.white)),
      ]);
}
