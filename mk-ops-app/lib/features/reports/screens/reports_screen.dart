import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import 'package:excel/excel.dart' hide Border;
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../shared/widgets/app_widgets.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  DateTime _from = DateTime.now().subtract(const Duration(days: 30));
  DateTime _to = DateTime.now();
  String? _selectedTeamId;
  String? _selectedProjectId;
  bool _exporting = false;

  Future<void> _pickDate(bool isFrom) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? _from : _to,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
            colorScheme: const ColorScheme.dark(primary: AppColors.blue)),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _from = picked;
        } else {
          _to = picked;
        }
      });
    }
  }

  Future<void> _exportExcel(
      List<Job> jobs, AppProfile profile) async {
    setState(() => _exporting = true);
    try {
      final excel = Excel.createExcel();
      final sheet = excel['İş Raporu'];

      // Headers
      final headers = [
        'Tarih', 'Proje', 'Ekip', 'İş Kalemi', 'Miktar', 'Birim', 'Durum',
        if (profile.isManager || profile.canSeePrices) 'Birim Fiyat',
        if (profile.isManager || profile.canSeePrices) 'Toplam',
      ];
      for (var i = 0; i < headers.length; i++) {
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0))
            .value = TextCellValue(headers[i]);
      }

      // Data
      for (var row = 0; row < jobs.length; row++) {
        final job = jobs[row];
        final cells = [
          formatDate(job.jobDate),
          job.project?.displayName ?? '—',
          job.team?.code ?? '—',
          job.workItem?.description ?? '—',
          job.quantity.toString(),
          job.workItem?.unitType ?? '—',
          job.statusLabel,
          if (profile.isManager || profile.canSeePrices)
            job.workItem?.unitPrice.toString() ?? '0',
          if (profile.isManager || profile.canSeePrices)
            job.totalValue.toString(),
        ];
        for (var col = 0; col < cells.length; col++) {
          sheet.cell(CellIndex.indexByColumnRow(columnIndex: col, rowIndex: row + 1))
              .value = TextCellValue(cells[col]);
        }
      }

      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/mk-ops-rapor-${DateTime.now().millisecondsSinceEpoch}.xlsx');
      final bytes = excel.encode();
      if (bytes != null) {
        await file.writeAsBytes(bytes);
        await Share.shareXFiles([XFile(file.path)], text: 'MK OPS İş Raporu');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Export hatası: $e'), backgroundColor: AppColors.red));
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider).valueOrNull;
    if (profile == null) return const SizedBox.shrink();

    final companyId = profile.companyId ?? '';
    final teamsAsync = ref.watch(teamsProvider(companyId));
    final projectsAsync = ref.watch(allProjectsProvider(companyId));

    final params = JobsParams(
      companyId: companyId,
      teamId: profile.isTeamLeader
          ? teamsAsync.valueOrNull
              ?.where((t) => t.leaderId == profile.id)
              .firstOrNull
              ?.id
          : _selectedTeamId,
      projectId: _selectedProjectId,
      status: 'approved',
      dateFrom: _from,
      dateTo: _to,
    );
    final jobsAsync = ref.watch(jobsProvider(params));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Raporlar'),
        actions: [
          if (_exporting)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.blue)),
            )
          else
            jobsAsync.whenOrNull(
                  data: (jobs) => IconButton(
                    icon: const Icon(Icons.download_outlined),
                    tooltip: 'Excel İndir',
                    onPressed: () => _exportExcel(jobs, profile),
                  ),
                ) ??
                const SizedBox.shrink(),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Date range
            Row(children: [
              Expanded(
                child: _DatePicker(
                    label: 'Başlangıç',
                    date: _from,
                    onTap: () => _pickDate(true)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DatePicker(
                    label: 'Bitiş',
                    date: _to,
                    onTap: () => _pickDate(false)),
              ),
            ]),
            const SizedBox(height: 12),

            // Team filter (manager)
            if (profile.isManager)
              teamsAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (teams) => DropdownButtonFormField<String?>(
                  value: _selectedTeamId,
                  dropdownColor: AppColors.navyMid,
                  style: const TextStyle(color: AppColors.white),
                  decoration: const InputDecoration(labelText: 'Ekip'),
                  items: [
                    const DropdownMenuItem(
                        value: null,
                        child: Text('Tüm Ekipler', style: TextStyle(color: AppColors.white))),
                    ...teams.map((t) => DropdownMenuItem(
                          value: t.id,
                          child: Text(t.code, style: const TextStyle(color: AppColors.white)),
                        )),
                  ],
                  onChanged: (v) => setState(() => _selectedTeamId = v),
                ),
              ),
            const SizedBox(height: 12),

            // Project filter
            projectsAsync.when(
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
              data: (projects) => DropdownButtonFormField<String?>(
                value: _selectedProjectId,
                dropdownColor: AppColors.navyMid,
                style: const TextStyle(color: AppColors.white),
                decoration: const InputDecoration(labelText: 'Proje'),
                items: [
                  const DropdownMenuItem(
                      value: null,
                      child: Text('Tüm Projeler', style: TextStyle(color: AppColors.white))),
                  ...projects.map((p) => DropdownMenuItem(
                        value: p.id,
                        child: Text(p.displayName,
                            style: const TextStyle(color: AppColors.white)),
                      )),
                ],
                onChanged: (v) => setState(() => _selectedProjectId = v),
              ),
            ),
            const SizedBox(height: 20),

            // Results
            jobsAsync.when(
              loading: () => const AppLoading(message: 'Raporlanıyor...'),
              error: (e, _) => AppError(message: e.toString()),
              data: (jobs) {
                if (jobs.isEmpty) {
                  return const EmptyState(
                      icon: Icons.bar_chart_outlined,
                      title: 'Sonuç bulunamadı',
                      subtitle: 'Seçili kriterlere uygun onaylı iş yok.');
                }

                final total = jobs.fold<double>(0, (s, j) => s + j.totalValue);
                final teamShare = jobs.fold<double>(
                    0,
                    (s, j) =>
                        s +
                        j.totalValue *
                            ((j.team?.percentage ?? 0) / 100));

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Summary
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.blue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.blue.withOpacity(0.2)),
                      ),
                      child: Row(children: [
                        Expanded(
                          child: _SummaryItem(
                              label: 'Toplam İş', value: jobs.length.toString()),
                        ),
                        if (profile.isManager || profile.canSeePrices) ...[
                          Expanded(
                              child: _SummaryItem(
                                  label: 'Brüt Toplam',
                                  value: formatCurrency(total))),
                          Expanded(
                              child: _SummaryItem(
                                  label: 'Ekip Payı',
                                  value: formatCurrency(teamShare))),
                        ],
                      ]),
                    ),
                    const SizedBox(height: 16),

                    // Export button
                    OutlinedButton.icon(
                      onPressed: _exporting ? null : () => _exportExcel(jobs, profile),
                      icon: const Icon(Icons.file_download_outlined),
                      label: const Text('Excel İndir / Paylaş'),
                    ),
                    const SizedBox(height: 16),

                    // Job list
                    ...jobs.map((job) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceCard,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.surfaceBorder),
                            ),
                            child: Row(children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(job.project?.displayName ?? '—',
                                        style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.white),
                                        overflow: TextOverflow.ellipsis),
                                    Text(
                                        '${job.workItem?.description ?? '—'} · ${job.team?.code ?? '—'}',
                                        style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColors.gray400)),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                      '${job.quantity} ${job.workItem?.unitType ?? ''}',
                                      style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.white)),
                                  if (profile.isManager || profile.canSeePrices)
                                    Text(formatCurrency(job.totalValue),
                                        style: const TextStyle(
                                            fontSize: 11, color: AppColors.green)),
                                  Text(formatDateShort(job.jobDate),
                                      style: const TextStyle(
                                          fontSize: 11, color: AppColors.gray500)),
                                ],
                              ),
                            ]),
                          ),
                        )),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _DatePicker extends StatelessWidget {
  final String label;
  final DateTime date;
  final VoidCallback onTap;

  const _DatePicker({required this.label, required this.date, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
          decoration: BoxDecoration(
            color: AppColors.navyMid,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.surfaceBorder),
          ),
          child: Row(children: [
            const Icon(Icons.calendar_today_outlined, size: 15, color: AppColors.gray400),
            const SizedBox(width: 6),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(fontSize: 10, color: AppColors.gray500)),
                Text(formatDate(date),
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.white)),
              ],
            ),
          ]),
        ),
      );
}

class _SummaryItem extends StatelessWidget {
  final String label;
  final String value;
  const _SummaryItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Column(children: [
        Text(value,
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.white)),
        Text(label,
            style: const TextStyle(fontSize: 10, color: AppColors.gray400)),
      ]);
}
