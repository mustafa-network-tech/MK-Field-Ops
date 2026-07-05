import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';

enum _RegMode { choose, newCompany, joinExisting }

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _companyNameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();

  _RegMode _mode = _RegMode.choose;
  bool _loading = false;
  bool _obscure = true;
  String? _error;
  bool _success = false;
  bool _isNewCompanySuccess = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _companyNameCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitNewCompany() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    final svc = ref.read(supabaseServiceProvider);
    final err = await svc.createNewCompanyAndRegister(
      email: _emailCtrl.text.trim(),
      password: _passCtrl.text,
      fullName: _nameCtrl.text.trim(),
      companyName: _companyNameCtrl.text.trim(),
      joinCode: _codeCtrl.text.trim(),
    );

    if (!mounted) return;
    if (err != null) {
      setState(() => _error = err);
    } else {
      setState(() {
        _success = true;
        _isNewCompanySuccess = true;
      });
    }
    setState(() => _loading = false);
  }

  Future<void> _submitJoinExisting() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    final svc = ref.read(supabaseServiceProvider);

    try {
      await svc.signUp(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text,
        fullName: _nameCtrl.text.trim(),
      );

      final joinErr = await svc.requestJoinCompany(
        companyName: _companyNameCtrl.text.trim(),
        joinCode: _codeCtrl.text.trim(),
      );

      if (!mounted) return;
      if (joinErr != null) {
        setState(() => _error =
            '$joinErr\n\nHesabınız oluşturuldu, şirket kodunu kontrol ederek tekrar giriş yapın.');
        return;
      }
      setState(() {
        _success = true;
        _isNewCompanySuccess = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().contains('already registered')
            ? 'Bu e-posta adresi zaten kayıtlı.'
            : 'Kayıt yapılamadı. Lütfen tekrar deneyin.';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Success screens ─────────────────────────────────────────────────────────

  Widget _buildSuccess() {
    final isNew = _isNewCompanySuccess;
    return Scaffold(
      backgroundColor: AppColors.navy,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.green.withOpacity(0.15),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(Icons.check_circle_outline,
                  color: AppColors.green, size: 40),
            ),
            const SizedBox(height: 24),
            Text(
              isNew ? 'Şirketiniz Oluşturuldu!' : 'Başvurunuz Alındı!',
              style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.white),
            ),
            const SizedBox(height: 12),
            Text(
              isNew
                  ? 'Şirketiniz ve yönetici hesabınız başarıyla oluşturuldu.\n\nGiriş yaparak kullanmaya başlayabilirsiniz.'
                  : 'Hesabınız oluşturuldu ve şirkete katılım talebiniz gönderildi.\n\nŞirket yöneticiniz hesabınızı onayladıktan sonra giriş yapabilirsiniz.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 14, color: AppColors.gray400, height: 1.6),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: () => context.go('/auth/login'),
                child: const Text('Giriş Ekranına Git'),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  // ── Mode: choose ────────────────────────────────────────────────────────────

  Widget _buildChoose() {
    return Scaffold(
      backgroundColor: AppColors.navy,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/auth/login'),
        ),
        title: const Text('Hesap Oluştur'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              const Text('Nasıl devam etmek istersiniz?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.white)),
              const SizedBox(height: 8),
              const Text(
                'Yeni bir şirket hesabı açabilir veya mevcut bir şirkete katılabilirsiniz.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.gray400, height: 1.5),
              ),
              const SizedBox(height: 40),

              // Yeni Şirket Kur
              _ModeCard(
                icon: Icons.add_business_outlined,
                title: 'Yeni Şirket Kur',
                description:
                    'Şirketiniz için yeni bir hesap oluşturun.\nSiz yönetici (Company Manager) olacaksınız.',
                color: AppColors.blue,
                onTap: () => setState(() => _mode = _RegMode.newCompany),
              ),
              const SizedBox(height: 16),

              // Mevcut Şirkete Katıl
              _ModeCard(
                icon: Icons.group_add_outlined,
                title: 'Mevcut Şirkete Katıl',
                description:
                    'Yöneticinizden aldığınız katılım koduyla mevcut bir şirket hesabına başvurun.',
                color: const Color(0xFF8B5CF6),
                onTap: () => setState(() => _mode = _RegMode.joinExisting),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Mode: form (new or join) ─────────────────────────────────────────────────

  Widget _buildForm() {
    final isNew = _mode == _RegMode.newCompany;

    return Scaffold(
      backgroundColor: AppColors.navy,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            _formKey.currentState?.reset();
            setState(() {
              _mode = _RegMode.choose;
              _error = null;
            });
          },
        ),
        title: Text(isNew ? 'Yeni Şirket Kur' : 'Şirkete Katıl'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Kişisel Bilgiler ─────────────────────────────────────────
                _SectionLabel(label: 'Kişisel Bilgiler'),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _nameCtrl,
                  style: const TextStyle(color: AppColors.white),
                  decoration: const InputDecoration(
                    labelText: 'Ad Soyad',
                    prefixIcon: Icon(Icons.person_outline, color: AppColors.gray400),
                  ),
                  validator: (v) =>
                      (v?.trim().length ?? 0) >= 2 ? null : 'Ad soyad zorunlu',
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  style: const TextStyle(color: AppColors.white),
                  decoration: const InputDecoration(
                    labelText: 'E-posta',
                    prefixIcon: Icon(Icons.email_outlined, color: AppColors.gray400),
                  ),
                  validator: (v) =>
                      (v?.contains('@') ?? false) ? null : 'Geçerli e-posta girin',
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _passCtrl,
                  obscureText: _obscure,
                  style: const TextStyle(color: AppColors.white),
                  decoration: InputDecoration(
                    labelText: 'Şifre',
                    hintText: 'En az 8 karakter',
                    prefixIcon: const Icon(Icons.lock_outline, color: AppColors.gray400),
                    suffixIcon: IconButton(
                      icon: Icon(
                          _obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                          color: AppColors.gray400),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) =>
                      (v?.length ?? 0) >= 8 ? null : 'En az 8 karakter',
                ),

                const SizedBox(height: 28),

                // ── Şirket Bilgileri ─────────────────────────────────────────
                _SectionLabel(label: isNew ? 'Yeni Şirket Bilgileri' : 'Şirket Bilgileri'),
                const SizedBox(height: 8),

                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.blue.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.blue.withOpacity(0.2)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.info_outline, color: AppColors.blue, size: 15),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        isNew
                            ? 'Şirketinizin adını ve personellerinizin sisteme katılmak için kullanacağı 4 haneli kodu belirleyin.'
                            : 'Katılmak istediğiniz şirketin adını ve yöneticinizden aldığınız 4 haneli katılım kodunu girin.',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.blue, height: 1.4),
                      ),
                    ),
                  ]),
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _companyNameCtrl,
                  style: const TextStyle(color: AppColors.white),
                  decoration: InputDecoration(
                    labelText: 'Şirket Adı',
                    prefixIcon: const Icon(Icons.business_outlined, color: AppColors.gray400),
                    hintText: isNew ? 'Şirketinizin tam adı' : null,
                  ),
                  validator: (v) =>
                      (v?.trim().length ?? 0) >= 2 ? null : 'Şirket adı zorunlu',
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _codeCtrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 22,
                      letterSpacing: 8,
                      fontWeight: FontWeight.w700),
                  textAlign: TextAlign.center,
                  decoration: InputDecoration(
                    labelText: isNew ? 'Katılım Kodu Belirleyin (4 hane)' : 'Katılım Kodu (4 hane)',
                    prefixIcon: const Icon(Icons.tag_rounded, color: AppColors.gray400),
                  ),
                  validator: (v) =>
                      (v?.length ?? 0) == 4 ? null : '4 haneli kod giriniz',
                ),

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

                const SizedBox(height: 32),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _loading
                        ? null
                        : (isNew ? _submitNewCompany : _submitJoinExisting),
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                color: AppColors.white, strokeWidth: 2))
                        : Text(
                            isNew ? 'Şirketi Kur ve Kaydol' : 'Kaydol ve Katılım Talebi Gönder',
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ),

                const SizedBox(height: 16),
                Text(
                  isNew
                      ? 'Ücretsiz deneme planı (Starter) ile başlarsınız.'
                      : 'Kaydolduktan sonra şirket yöneticinizin hesabınızı onaylaması gerekir.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.gray500, height: 1.5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_success) return _buildSuccess();
    if (_mode == _RegMode.choose) return _buildChoose();
    return _buildForm();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

class _ModeCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color color;
  final VoidCallback onTap;

  const _ModeCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surfaceCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 26),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.white)),
                  const SizedBox(height: 4),
                  Text(description,
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.gray400,
                          height: 1.4)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right_rounded, color: color.withOpacity(0.7)),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(label,
        style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.gray400,
            letterSpacing: 0.5));
  }
}
