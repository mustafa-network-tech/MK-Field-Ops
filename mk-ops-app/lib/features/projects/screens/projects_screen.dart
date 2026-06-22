import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../shared/widgets/app_widgets.dart';

class ProjectsScreen extends ConsumerStatefulWidget {
  const ProjectsScreen({super.key});

  @override
  ConsumerState<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends ConsumerState<ProjectsScreen> {
  String _filter = 'ACTIVE';

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider).valueOrNull;
    final companyId = profile?.companyId ?? '';
    final projectsAsync = ref.watch(allProjectsProvider(companyId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Projeler')),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                ('ACTIVE', 'Aktif'),
                ('COMPLETED', 'Tamamlandı'),
                ('ARCHIVED', 'Arşiv'),
              ].map((s) {
                final selected = _filter == s.$1;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(s.$2),
                    selected: selected,
                    onSelected: (_) => setState(() => _filter = s.$1),
                    selectedColor: projectStatusColor(s.$1).withOpacity(0.2),
                    labelStyle: TextStyle(
                        color: selected ? projectStatusColor(s.$1) : AppColors.gray300,
                        fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                        fontSize: 12),
                    side: BorderSide(
                        color: selected
                            ? projectStatusColor(s.$1)
                            : AppColors.surfaceBorder),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: projectsAsync.when(
              loading: () => const AppLoading(),
              error: (e, _) => AppError(message: e.toString()),
              data: (all) {
                final filtered =
                    all.where((p) => p.status == _filter).toList();
                if (filtered.isEmpty) {
                  return EmptyState(
                      icon: Icons.folder_off_outlined,
                      title: _filter == 'ACTIVE'
                          ? 'Aktif proje yok'
                          : 'Bu kategoride proje yok');
                }
                return RefreshIndicator(
                  color: AppColors.blue,
                  onRefresh: () async => ref.invalidate(allProjectsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _ProjectTile(project: filtered[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ProjectTile extends StatelessWidget {
  final Project project;
  const _ProjectTile({required this.project});

  @override
  Widget build(BuildContext context) {
    return Container(
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
                project.displayName,
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.white),
              ),
            ),
            ProjectStatusBadge(status: project.status),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.tag, size: 13, color: AppColors.gray500),
            const SizedBox(width: 4),
            Text(project.displayKey,
                style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
            const Spacer(),
            const Icon(Icons.calendar_today_outlined, size: 13, color: AppColors.gray500),
            const SizedBox(width: 4),
            Text(formatDate(project.receivedDate),
                style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
          ]),
          if (project.description != null && project.description!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(project.description!,
                style: const TextStyle(fontSize: 12, color: AppColors.gray500),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],
        ],
      ),
    );
  }
}
