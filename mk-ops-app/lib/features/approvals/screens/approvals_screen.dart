import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../shared/widgets/app_widgets.dart';

class ApprovalsScreen extends ConsumerWidget {
  const ApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).valueOrNull;
    if (profile == null || !profile.isManager) {
      return Scaffold(
        appBar: AppBar(title: const Text('Onaylar')),
        body: const Center(
          child: Text('Bu ekran yalnızca yöneticilere görünür.',
              style: TextStyle(color: AppColors.gray400)),
        ),
      );
    }

    final companyId = profile.companyId ?? '';
    final jobsAsync = ref.watch(pendingApprovalsProvider(companyId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(children: [
          const Text('Onay Bekleyenler'),
          jobsAsync.whenOrNull(
                data: (jobs) => jobs.isNotEmpty
                    ? Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.orange,
                          borderRadius: BorderRadius.circular(100),
                        ),
                        child: Text('${jobs.length}',
                            style: const TextStyle(
                                fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.white)),
                      )
                    : null,
              ) ??
              const SizedBox.shrink(),
        ]),
      ),
      body: jobsAsync.when(
        loading: () => const AppLoading(message: 'Yükleniyor...'),
        error: (e, _) => AppError(
            message: e.toString(),
            onRetry: () => ref.invalidate(pendingApprovalsProvider)),
        data: (jobs) => jobs.isEmpty
            ? const EmptyState(
                icon: Icons.check_circle_outline,
                title: 'Onay bekleyen iş yok',
                subtitle: 'Tüm işler işlendi.')
            : RefreshIndicator(
                color: AppColors.blue,
                onRefresh: () async => ref.invalidate(pendingApprovalsProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: jobs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) =>
                      _ApprovalTile(job: jobs[i], profile: profile),
                ),
              ),
      ),
    );
  }
}

class _ApprovalTile extends ConsumerWidget {
  final Job job;
  final AppProfile profile;
  const _ApprovalTile({required this.job, required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final svc = ref.read(supabaseServiceProvider);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.orange.withOpacity(0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(job.project?.displayName ?? '—',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.white),
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text('${job.team?.code ?? '—'} · ${formatDate(job.jobDate)}',
                      style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
                ],
              ),
            ),
            GestureDetector(
              onTap: () => context.go('/jobs/${job.id}'),
              child: const Icon(Icons.open_in_new, size: 18, color: AppColors.gray400),
            ),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            const Icon(Icons.work_outline, size: 13, color: AppColors.gray500),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                job.workItem?.description ?? '—',
                style: const TextStyle(fontSize: 12, color: AppColors.gray400),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text('${job.quantity} ${job.workItem?.unitType ?? ''}',
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.white)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => _reject(context, ref, svc),
                style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.red,
                    side: const BorderSide(color: AppColors.red),
                    padding: const EdgeInsets.symmetric(vertical: 10)),
                child: const Text('Reddet',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: () async {
                  await svc.approveJob(job.id, profile.id);
                  if (context.mounted) {
                    ref.invalidate(pendingApprovalsProvider);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Onaylandı.'),
                        backgroundColor: AppColors.green));
                  }
                },
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.green,
                    padding: const EdgeInsets.symmetric(vertical: 10)),
                child: const Text('Onayla',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Future<void> _reject(BuildContext context, WidgetRef ref, svc) async {
    final reasonCtrl = TextEditingController();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Red Nedeni'),
        content: TextField(
          controller: reasonCtrl,
          maxLines: 3,
          decoration: const InputDecoration(hintText: 'Red nedenini yazın...'),
          style: const TextStyle(color: AppColors.white),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('İptal')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Reddet', style: TextStyle(color: AppColors.red))),
        ],
      ),
    );
    if (confirm == true && context.mounted) {
      await svc.rejectJob(job.id, profile.id, reasonCtrl.text.trim());
      ref.invalidate(pendingApprovalsProvider);
    }
  }
}
