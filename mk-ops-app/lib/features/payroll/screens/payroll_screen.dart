import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../shared/widgets/app_widgets.dart';

class PayrollScreen extends ConsumerStatefulWidget {
  const PayrollScreen({super.key});

  @override
  ConsumerState<PayrollScreen> createState() => _PayrollScreenState();
}

class _PayrollScreenState extends ConsumerState<PayrollScreen> {
  PayrollPeriod? _selectedPeriod;
  Team? _selectedTeam;

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider).valueOrNull;
    if (profile == null) return const SizedBox.shrink();

    final companyId = profile.companyId ?? '';
    final periodsAsync = ref.watch(
        FutureProvider.autoDispose<List<PayrollPeriod>>((r) =>
            r.watch(supabaseServiceProvider).fetchPayrollPeriods(companyId)));
    final teamsAsync = ref.watch(teamsProvider(companyId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Hakediş')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Period selector
            periodsAsync.when(
              loading: () => const SizedBox(height: 52, child: AppLoading()),
              error: (_, __) => const SizedBox.shrink(),
              data: (periods) {
                if (periods.isEmpty) return const SizedBox.shrink();
                _selectedPeriod ??= periods.firstWhere(
                    (p) => p.isActive,
                    orElse: () => periods.first);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Dönem',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.gray400, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<PayrollPeriod>(
                      value: _selectedPeriod,
                      dropdownColor: AppColors.navyMid,
                      style: const TextStyle(color: AppColors.white),
                      decoration: const InputDecoration(),
                      items: periods
                          .map((p) => DropdownMenuItem(
                                value: p,
                                child: Text(
                                    '${formatDate(p.startDate)} – ${formatDate(p.endDate)}${p.isLocked ? ' 🔒' : ' ✓'}',
                                    style: const TextStyle(color: AppColors.white, fontSize: 14)),
                              ))
                          .toList(),
                      onChanged: (p) => setState(() => _selectedPeriod = p),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 16),

            // Team filter (manager only)
            if (profile.isManager)
              teamsAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (teams) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Ekip Filtresi',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.gray400, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<Team?>(
                      value: _selectedTeam,
                      dropdownColor: AppColors.navyMid,
                      style: const TextStyle(color: AppColors.white),
                      decoration: const InputDecoration(),
                      items: [
                        const DropdownMenuItem(
                            value: null,
                            child: Text('Tüm Ekipler',
                                style: TextStyle(color: AppColors.white))),
                        ...teams.map((t) => DropdownMenuItem(
                              value: t,
                              child: Text(t.code,
                                  style: const TextStyle(color: AppColors.white)),
                            )),
                      ],
                      onChanged: (t) => setState(() => _selectedTeam = t),
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),

            // Summary cards
            if (_selectedPeriod != null)
              _PayrollSummaryCard(
                profile: profile,
                companyId: companyId,
                period: _selectedPeriod!,
                team: _selectedTeam,
              ),
          ],
        ),
      ),
    );
  }
}

class _PayrollSummaryCard extends ConsumerWidget {
  final AppProfile profile;
  final String companyId;
  final PayrollPeriod period;
  final Team? team;

  const _PayrollSummaryCard({
    required this.profile,
    required this.companyId,
    required this.period,
    this.team,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params = PayrollParams(
      companyId: companyId,
      profile: profile,
      periodId: period.id,
      teamId: team?.id,
    );
    final summaryAsync = ref.watch(payrollSummaryProvider(params));

    return summaryAsync.when(
      loading: () => const AppLoading(message: 'Hesaplanıyor...'),
      error: (e, _) => AppError(message: e.toString()),
      data: (s) => Column(
        children: [
          // Main earnings card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.blue.withOpacity(0.2), AppColors.green.withOpacity(0.1)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.blue.withOpacity(0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${formatDate(period.startDate)} – ${formatDate(period.endDate)}',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.gray400, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 8),
                if (profile.isManager || profile.canSeePrices) ...[
                  Text(formatCurrency(s.totalGross),
                      style: const TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                          color: AppColors.white)),
                  const Text('Toplam Brüt',
                      style: TextStyle(fontSize: 12, color: AppColors.gray400)),
                ] else ...[
                  Text(formatCurrency(s.teamShare),
                      style: const TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                          color: AppColors.green)),
                  const Text('Ekip Hakedişi',
                      style: TextStyle(fontSize: 12, color: AppColors.gray400)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Detail grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.6,
            children: [
              if (profile.isManager) ...[
                StatCard(
                  label: 'Ekip Hakedişi',
                  value: formatCurrency(s.teamShare),
                  icon: Icons.groups_outlined,
                  color: AppColors.green,
                ),
                StatCard(
                  label: 'Şirket Payı',
                  value: formatCurrency(s.companyShare),
                  icon: Icons.business_outlined,
                  color: AppColors.blue,
                ),
              ],
              StatCard(
                label: 'Onaylı İş',
                value: s.approvedJobCount.toString(),
                icon: Icons.check_circle_outline,
                color: AppColors.green,
              ),
              StatCard(
                label: 'Bekleyen İş',
                value: s.pendingJobCount.toString(),
                icon: Icons.pending_outlined,
                color: AppColors.orange,
              ),
            ],
          ),

          if (period.isLocked) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.gray700,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(children: [
                Icon(Icons.lock_outline, color: AppColors.gray400, size: 16),
                SizedBox(width: 8),
                Text('Bu dönem kilitlendi',
                    style: TextStyle(color: AppColors.gray400, fontSize: 13)),
              ]),
            ),
          ],
        ],
      ),
    );
  }
}
