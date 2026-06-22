import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../shared/widgets/app_widgets.dart';

class TeamsScreen extends ConsumerWidget {
  const TeamsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).valueOrNull;
    if (profile == null) return const SizedBox.shrink();

    final companyId = profile.companyId ?? '';
    final teamsAsync = ref.watch(teamsProvider(companyId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Ekipler')),
      body: teamsAsync.when(
        loading: () => const AppLoading(),
        error: (e, _) => AppError(message: e.toString()),
        data: (allTeams) {
          final teams = profile.isTeamLeader
              ? allTeams.where((t) => t.leaderId == profile.id).toList()
              : allTeams;

          if (teams.isEmpty) {
            return const EmptyState(
                icon: Icons.groups_outlined,
                title: 'Ekip bulunamadı',
                subtitle: 'Henüz onaylı ekip yok.');
          }

          return RefreshIndicator(
            color: AppColors.blue,
            onRefresh: () async => ref.invalidate(teamsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: teams.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) =>
                  _TeamCard(team: teams[i], profile: profile),
            ),
          );
        },
      ),
    );
  }
}

class _TeamCard extends ConsumerWidget {
  final Team team;
  final AppProfile profile;
  const _TeamCard({required this.team, required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final companyId = profile.companyId ?? '';
    final periodAsync = ref.watch(activePeriodProvider(companyId));

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.blue.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  team.code.length >= 2 ? team.code.substring(0, 2) : team.code,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.blue),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(team.code,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.white)),
                  if (team.description != null)
                    Text(team.description!,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.gray400)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.green.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('%${team.percentage.toStringAsFixed(0)}',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.green)),
            ),
          ]),

          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.surfaceBorder),
          const SizedBox(height: 12),

          // Period summary
          periodAsync.when(
            loading: () => const SizedBox(height: 20, child: LinearProgressIndicator()),
            error: (_, __) => const SizedBox.shrink(),
            data: (period) {
              if (period == null) return const SizedBox.shrink();
              final params = PayrollParams(
                  companyId: companyId,
                  profile: profile,
                  periodId: period.id,
                  teamId: profile.isManager ? team.id : null);
              final summaryAsync = ref.watch(payrollSummaryProvider(params));
              return summaryAsync.when(
                loading: () => const SizedBox(
                    height: 20, child: LinearProgressIndicator(color: AppColors.blue)),
                error: (_, __) => const SizedBox.shrink(),
                data: (summary) => Row(children: [
                  _MiniStat(
                    label: 'Dönem Hakedişi',
                    value: profile.isTeamLeader && !profile.canSeePrices
                        ? '—'
                        : formatCurrency(summary.teamShare),
                    color: AppColors.green,
                  ),
                  const SizedBox(width: 12),
                  _MiniStat(
                    label: 'Onaylı İş',
                    value: summary.approvedJobCount.toString(),
                    color: AppColors.blue,
                  ),
                  const SizedBox(width: 12),
                  _MiniStat(
                    label: 'Bekleyen',
                    value: summary.pendingJobCount.toString(),
                    color: AppColors.orange,
                  ),
                ]),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MiniStat({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w700, color: color)),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(fontSize: 10, color: AppColors.gray400),
                textAlign: TextAlign.center),
          ],
        ),
      );
}
