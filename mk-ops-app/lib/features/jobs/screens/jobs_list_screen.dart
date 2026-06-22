import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../shared/widgets/app_widgets.dart';

class JobsListScreen extends ConsumerStatefulWidget {
  const JobsListScreen({super.key});

  @override
  ConsumerState<JobsListScreen> createState() => _JobsListScreenState();
}

class _JobsListScreenState extends ConsumerState<JobsListScreen> {
  String? _statusFilter;

  final _statuses = [
    (null, 'Tümü'),
    ('draft', 'Taslak'),
    ('submitted', 'Onay Bekliyor'),
    ('approved', 'Onaylandı'),
    ('rejected', 'Reddedildi'),
  ];

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider).valueOrNull;
    if (profile == null) return const SizedBox.shrink();

    final companyId = profile.companyId ?? '';

    // For TL, scope to own team
    final teamsAsync = ref.watch(teamsProvider(companyId));
    String? teamId;
    if (profile.isTeamLeader) {
      final teams = teamsAsync.valueOrNull ?? [];
      final myTeam = teams.where((t) => t.leaderId == profile.id).firstOrNull;
      teamId = myTeam?.id;
    }

    final params = JobsParams(
      companyId: companyId,
      teamId: teamId,
      status: _statusFilter,
    );
    final jobsAsync = ref.watch(jobsProvider(params));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('İşlerim'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => context.go('/job-entry'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: _statuses.map((s) {
                final isSelected = _statusFilter == s.$1;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(s.$2),
                    selected: isSelected,
                    onSelected: (_) => setState(() => _statusFilter = s.$1),
                    selectedColor: AppColors.blue.withOpacity(0.2),
                    labelStyle: TextStyle(
                        color: isSelected ? AppColors.blue : AppColors.gray300,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                        fontSize: 12),
                    side: BorderSide(
                        color: isSelected
                            ? AppColors.blue
                            : AppColors.surfaceBorder),
                  ),
                );
              }).toList(),
            ),
          ),

          // Jobs list
          Expanded(
            child: jobsAsync.when(
              loading: () => const AppLoading(message: 'İşler yükleniyor...'),
              error: (e, _) => AppError(
                  message: e.toString(),
                  onRetry: () => ref.invalidate(jobsProvider)),
              data: (jobs) => jobs.isEmpty
                  ? EmptyState(
                      icon: Icons.work_off_outlined,
                      title: 'İş kaydı bulunamadı',
                      subtitle: 'Yeni iş eklemek için + butonuna basın.',
                      action: ElevatedButton.icon(
                        onPressed: () => context.go('/job-entry'),
                        icon: const Icon(Icons.add),
                        label: const Text('Yeni İş Gir'),
                      ),
                    )
                  : RefreshIndicator(
                      color: AppColors.blue,
                      onRefresh: () async => ref.invalidate(jobsProvider),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: jobs.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) => _JobTile(job: jobs[i]),
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _JobTile extends StatelessWidget {
  final Job job;
  const _JobTile({required this.job});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/jobs/${job.id}'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.surfaceBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(
                  job.project?.displayName ?? 'Proje yok',
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.white),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              StatusBadge(status: job.status),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.work_outline, size: 14, color: AppColors.gray400),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  job.workItem?.description ?? job.workItemId,
                  style: const TextStyle(fontSize: 12, color: AppColors.gray400),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.groups_outlined, size: 14, color: AppColors.gray400),
              const SizedBox(width: 4),
              Text(job.team?.code ?? '',
                  style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
              const Spacer(),
              Text(
                '${job.quantity} ${job.workItem?.unitType ?? ''}',
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.white),
              ),
              const SizedBox(width: 8),
              Text(formatDate(job.jobDate),
                  style: const TextStyle(fontSize: 12, color: AppColors.gray500)),
            ]),
          ],
        ),
      ),
    );
  }
}
