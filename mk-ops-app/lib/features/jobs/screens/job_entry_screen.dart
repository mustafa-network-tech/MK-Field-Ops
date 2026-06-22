import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/app_models.dart';
import '../../../core/constants/app_constants.dart';
import '../../../shared/widgets/app_widgets.dart';

class JobEntryScreen extends ConsumerStatefulWidget {
  const JobEntryScreen({super.key});

  @override
  ConsumerState<JobEntryScreen> createState() => _JobEntryScreenState();
}

class _JobEntryScreenState extends ConsumerState<JobEntryScreen> {
  final _formKey = GlobalKey<FormState>();
  DateTime _date = DateTime.now();
  Project? _project;
  Team? _team;
  WorkItem? _workItem;
  final _quantityCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final List<XFile> _photos = [];
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _quantityCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    if (_photos.length >= 3) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('En fazla 3 fotoğraf ekleyebilirsiniz.')));
      return;
    }
    final picker = ImagePicker();
    final img = await picker.pickImage(
        source: ImageSource.camera, imageQuality: 70, maxWidth: 1200);
    if (img != null) setState(() => _photos.add(img));
  }

  Future<void> _submit({bool asDraft = false}) async {
    if (!_formKey.currentState!.validate()) return;
    if (_project == null) {
      setState(() => _error = 'Proje seçin.');
      return;
    }
    if (_team == null) {
      setState(() => _error = 'Ekip seçin.');
      return;
    }
    if (_workItem == null) {
      setState(() => _error = 'İş kalemi seçin.');
      return;
    }

    setState(() { _loading = true; _error = null; });

    try {
      final profile = ref.read(profileProvider).valueOrNull!;
      final svc = ref.read(supabaseServiceProvider);

      final jobData = {
        'company_id': profile.companyId,
        'job_date': DateFormat('yyyy-MM-dd').format(_date),
        'project_id': _project!.id,
        'team_id': _team!.id,
        'work_item_id': _workItem!.id,
        'quantity': double.parse(_quantityCtrl.text),
        'notes': _notesCtrl.text.trim(),
        'status': asDraft ? AppConstants.jobDraft : AppConstants.jobSubmitted,
        'created_by': profile.id,
        'updated_at': DateTime.now().toIso8601String(),
      };

      await svc.createJob(jobData);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(asDraft
            ? 'Taslak kaydedildi.'
            : 'İş onaya gönderildi.'),
        backgroundColor: AppColors.green,
      ));
      context.go('/jobs');
    } catch (e) {
      setState(() => _error = 'Kaydedilemedi: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileProvider);
    final profile = profileAsync.valueOrNull;
    final companyId = profile?.companyId ?? '';

    final projectsAsync = ref.watch(projectsProvider(companyId));
    final teamsAsync = ref.watch(teamsProvider(companyId));
    final workItemsAsync = ref.watch(workItemsProvider(companyId));

    List<Project> projects = projectsAsync.valueOrNull ?? [];
    List<Team> allTeams = teamsAsync.valueOrNull ?? [];
    List<WorkItem> workItems = workItemsAsync.valueOrNull ?? [];

    // TL only sees own team
    List<Team> teams = profile?.isTeamLeader == true
        ? allTeams.where((t) => t.leaderId == profile?.id).toList()
        : allTeams;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Yeni İş Gir')),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Date
              _FieldLabel('Tarih'),
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _date,
                    firstDate: DateTime.now().subtract(const Duration(days: 90)),
                    lastDate: DateTime.now(),
                    builder: (ctx, child) => Theme(
                      data: Theme.of(ctx).copyWith(
                        colorScheme: const ColorScheme.dark(primary: AppColors.blue),
                      ),
                      child: child!,
                    ),
                  );
                  if (picked != null) setState(() => _date = picked);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.navyMid,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.surfaceBorder),
                  ),
                  child: Row(children: [
                    const Icon(Icons.calendar_today_outlined,
                        color: AppColors.gray400, size: 18),
                    const SizedBox(width: 10),
                    Text(DateFormat('dd MMMM yyyy', 'tr_TR').format(_date),
                        style: const TextStyle(color: AppColors.white, fontSize: 15)),
                    const Spacer(),
                    const Icon(Icons.chevron_right, color: AppColors.gray500, size: 18),
                  ]),
                ),
              ),
              const SizedBox(height: 16),

              // Project
              _FieldLabel('Proje *'),
              _DropdownField<Project>(
                value: _project,
                items: projects,
                hint: projectsAsync.isLoading ? 'Yükleniyor...' : 'Proje seçin',
                itemLabel: (p) => p.displayName,
                onChanged: (p) => setState(() => _project = p),
              ),
              const SizedBox(height: 16),

              // Work item
              _FieldLabel('İş Kalemi *'),
              _DropdownField<WorkItem>(
                value: _workItem,
                items: workItems,
                hint: workItemsAsync.isLoading ? 'Yükleniyor...' : 'İş kalemi seçin',
                itemLabel: (w) => '${w.code} – ${w.description}',
                onChanged: (w) => setState(() => _workItem = w),
              ),
              const SizedBox(height: 16),

              // Team
              _FieldLabel('Ekip *'),
              _DropdownField<Team>(
                value: _team,
                items: teams,
                hint: teamsAsync.isLoading ? 'Yükleniyor...' : 'Ekip seçin',
                itemLabel: (t) => t.code + (t.description != null ? ' – ${t.description}' : ''),
                onChanged: (t) => setState(() => _team = t),
              ),
              const SizedBox(height: 16),

              // Quantity
              _FieldLabel('Miktar *'),
              TextFormField(
                controller: _quantityCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(color: AppColors.white),
                decoration: InputDecoration(
                  hintText: '0',
                  suffixText: _workItem?.unitType,
                  suffixStyle: const TextStyle(color: AppColors.gray400),
                ),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  if (n == null || n <= 0) return 'Geçerli miktar girin';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Notes
              _FieldLabel('Not'),
              TextFormField(
                controller: _notesCtrl,
                maxLines: 3,
                style: const TextStyle(color: AppColors.white),
                decoration: const InputDecoration(
                  hintText: 'İş notu ekleyin...',
                ),
              ),
              const SizedBox(height: 16),

              // Photos
              _FieldLabel('Fotoğraflar (en fazla 3)'),
              Row(children: [
                ..._photos.map((p) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Stack(children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(p.path,
                              width: 72, height: 72, fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                    width: 72, height: 72,
                                    color: AppColors.navyMid,
                                    child: const Icon(Icons.image, color: AppColors.gray500),
                                  )),
                        ),
                        Positioned(
                          top: 2, right: 2,
                          child: GestureDetector(
                            onTap: () => setState(() => _photos.remove(p)),
                            child: Container(
                              decoration: const BoxDecoration(
                                  color: AppColors.red, shape: BoxShape.circle),
                              child: const Icon(Icons.close, size: 14, color: AppColors.white),
                            ),
                          ),
                        ),
                      ]),
                    )),
                if (_photos.length < 3)
                  GestureDetector(
                    onTap: _pickPhoto,
                    child: Container(
                      width: 72, height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.navyMid,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.surfaceBorder),
                      ),
                      child: const Icon(Icons.add_a_photo_outlined,
                          color: AppColors.gray400, size: 24),
                    ),
                  ),
              ]),

              if (_error != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.red.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.red.withOpacity(0.3)),
                  ),
                  child: Text(_error!,
                      style: const TextStyle(color: AppColors.red, fontSize: 13)),
                ),
              ],

              const SizedBox(height: 28),

              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _loading ? null : () => _submit(asDraft: true),
                    child: const Text('Taslak Kaydet'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _loading ? null : () => _submit(),
                    child: _loading
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(
                                color: AppColors.white, strokeWidth: 2))
                        : const Text('Onaya Gönder',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ]),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.gray300)),
      );
}

class _DropdownField<T> extends StatelessWidget {
  final T? value;
  final List<T> items;
  final String hint;
  final String Function(T) itemLabel;
  final void Function(T?) onChanged;

  const _DropdownField({
    required this.value,
    required this.items,
    required this.hint,
    required this.itemLabel,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      value: value,
      isExpanded: true,
      dropdownColor: AppColors.navyMid,
      style: const TextStyle(color: AppColors.white, fontSize: 15),
      decoration: InputDecoration(hintText: hint),
      items: items
          .map((item) => DropdownMenuItem(
                value: item,
                child: Text(itemLabel(item),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.white)),
              ))
          .toList(),
      onChanged: onChanged,
    );
  }
}
