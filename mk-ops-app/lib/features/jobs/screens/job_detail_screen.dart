import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../shared/widgets/app_widgets.dart';

class JobDetailScreen extends ConsumerWidget {
  final String jobId;
  const JobDetailScreen({super.key, required this.jobId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobAsync = ref.watch(
        FutureProvider.autoDispose<Job?>((r) =>
            r.watch(supabaseServiceProvider).fetchJob(jobId)));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('İş Detayı')),
      body: jobAsync.when(
        loading: () => const AppLoading(),
        error: (e, _) => AppError(message: e.toString()),
        data: (job) {
          if (job == null) {
            return const EmptyState(
                icon: Icons.search_off,
                title: 'İş kaydı bulunamadı');
          }
          return _JobDetailBody(job: job);
        },
      ),
    );
  }
}

class _JobDetailBody extends ConsumerWidget {
  final Job job;
  const _JobDetailBody({required this.job});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).valueOrNull;
    final svc = ref.read(supabaseServiceProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Status header
          Container(
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
                  Expanded(
                    child: Text(
                      job.project?.displayName ?? 'Proje bilgisi yok',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.white),
                    ),
                  ),
                  StatusBadge(status: job.status),
                ]),
                const SizedBox(height: 12),
                _DetailRow(Icons.calendar_today_outlined, 'Tarih', formatDate(job.jobDate)),
                _DetailRow(Icons.groups_outlined, 'Ekip', job.team?.code ?? '—'),
                _DetailRow(Icons.work_outline, 'İş Kalemi',
                    job.workItem?.description ?? '—'),
                _DetailRow(Icons.straighten_outlined, 'Miktar',
                    '${job.quantity} ${job.workItem?.unitType ?? ''}'),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Payroll info (hide unit price from TL)
          if (profile?.isManager == true || profile?.canSeePrices == true) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.green.withOpacity(0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.green.withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Hakediş Bilgisi',
                      style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.green)),
                  const SizedBox(height: 10),
                  _DetailRow(Icons.attach_money, 'Birim Fiyat',
                      formatCurrency(job.workItem?.unitPrice ?? 0)),
                  _DetailRow(Icons.calculate_outlined, 'İş Toplamı',
                      formatCurrency(job.totalValue)),
                  if (job.team != null)
                    _DetailRow(Icons.percent, 'Ekip Payı (%${job.team!.percentage.toStringAsFixed(0)})',
                        formatCurrency(job.totalValue * (job.team!.percentage / 100))),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Notes
          if (job.notes.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceCard,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.surfaceBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Not',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.gray400, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  Text(job.notes,
                      style: const TextStyle(color: AppColors.gray200, fontSize: 14, height: 1.5)),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Rejection reason
          if (job.isRejected && job.rejectionReason != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.red.withOpacity(0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.red.withOpacity(0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(children: [
                    Icon(Icons.cancel_outlined, color: AppColors.red, size: 16),
                    SizedBox(width: 6),
                    Text('Red Nedeni',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.red, fontWeight: FontWeight.w600)),
                  ]),
                  const SizedBox(height: 6),
                  Text(job.rejectionReason!,
                      style: const TextStyle(color: AppColors.gray200, fontSize: 14)),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          const SizedBox(height: 8),

          // Actions for submitted jobs (manager only)
          if (job.isSubmitted && profile?.isManager == true) ...[
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showRejectDialog(context, ref, svc, profile!),
                  style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.red,
                      side: const BorderSide(color: AppColors.red)),
                  icon: const Icon(Icons.close, size: 18),
                  label: const Text('Reddet'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await svc.approveJob(job.id, profile!.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('İş onaylandı.'),
                          backgroundColor: AppColors.green));
                      context.go('/approvals');
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.green),
                  icon: const Icon(Icons.check, size: 18),
                  label: const Text('Onayla', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ]),
          ],

          // Draft actions
          if (job.isDraft) ...[
            ElevatedButton(
              onPressed: () async {
                await svc.submitJob(job.id);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Onaya gönderildi.'),
                      backgroundColor: AppColors.green));
                  context.go('/jobs');
                }
              },
              child: const Text('Onaya Gönder'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: const Text('Sil'),
                    content: const Text('Bu iş kaydını silmek istiyor musunuz?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('İptal')),
                      TextButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Sil',
                              style: TextStyle(color: AppColors.red))),
                    ],
                  ),
                );
                if (confirm == true) {
                  await svc.deleteJob(job.id);
                  if (context.mounted) context.go('/jobs');
                }
              },
              style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.red,
                  side: const BorderSide(color: AppColors.red)),
              child: const Text('Sil'),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _showRejectDialog(
      BuildContext context, WidgetRef ref, svc, profile) async {
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
    if (confirm == true) {
      await svc.rejectJob(job.id, profile.id, reasonCtrl.text.trim());
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('İş reddedildi.'), backgroundColor: AppColors.red));
        context.go('/approvals');
      }
    }
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          Icon(icon, size: 15, color: AppColors.gray500),
          const SizedBox(width: 8),
          Text(label,
              style: const TextStyle(fontSize: 13, color: AppColors.gray400)),
          const Spacer(),
          Text(value,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.white)),
        ]),
      );
}
