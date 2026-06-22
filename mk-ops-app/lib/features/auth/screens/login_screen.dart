import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(supabaseServiceProvider);
      await svc.signIn(_emailCtrl.text.trim(), _passCtrl.text);
      if (!mounted) return;
      final profile = await svc.fetchCurrentProfile();
      if (!mounted) return;
      if (profile == null || profile.companyId == null) {
        context.go('/auth/no-company');
        return;
      }
      if (!profile.isApproved) {
        context.go('/auth/pending');
        return;
      }
      final company = await svc.fetchCompany(profile.companyId!);
      if (!mounted) return;
      if (company == null || !company.isActive) {
        context.go('/auth/no-company');
        return;
      }
      await ref.read(profileProvider.notifier).reload();
      context.go('/dashboard');
    } catch (e) {
      setState(() => _error = _parseError(e.toString()));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _parseError(String e) {
    if (e.contains('Invalid login')) return 'E-posta veya şifre hatalı.';
    if (e.contains('Email not confirmed')) return 'E-posta adresinizi doğrulayın.';
    if (e.contains('network')) return 'Ağ bağlantısı hatası.';
    return 'Giriş yapılamadı. Lütfen tekrar deneyin.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.navy,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                Center(
                  child: Column(children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.blue.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.blue.withOpacity(0.25)),
                      ),
                      child: const Icon(Icons.bolt_rounded, color: AppColors.blue, size: 40),
                    ),
                    const SizedBox(height: 16),
                    const Text('MK OPS',
                        style: TextStyle(
                            fontSize: 26, fontWeight: FontWeight.w800,
                            color: AppColors.white, letterSpacing: 1.5)),
                    const SizedBox(height: 4),
                    const Text('Hesabınıza giriş yapın',
                        style: TextStyle(fontSize: 14, color: AppColors.gray400)),
                  ]),
                ),
                const SizedBox(height: 40),
                Form(
                  key: _formKey,
                  child: Column(children: [
                    TextFormField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      style: const TextStyle(color: AppColors.white),
                      decoration: const InputDecoration(
                        labelText: 'E-posta',
                        prefixIcon: Icon(Icons.email_outlined, color: AppColors.gray400),
                      ),
                      validator: (v) => (v?.contains('@') ?? false) ? null : 'Geçerli e-posta girin',
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _passCtrl,
                      obscureText: _obscure,
                      style: const TextStyle(color: AppColors.white),
                      decoration: InputDecoration(
                        labelText: 'Şifre',
                        prefixIcon: const Icon(Icons.lock_outline, color: AppColors.gray400),
                        suffixIcon: IconButton(
                          icon: Icon(
                              _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                              color: AppColors.gray400),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v?.length ?? 0) >= 6 ? null : 'En az 6 karakter',
                    ),
                  ]),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => context.go('/auth/forgot-password'),
                    child: const Text('Şifremi Unuttum',
                        style: TextStyle(color: AppColors.blue, fontSize: 13)),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
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
                const SizedBox(height: 24),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                color: AppColors.white, strokeWidth: 2))
                        : const Text('Giriş Yap',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(height: 20),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Text('Hesabınız yok mu? ',
                      style: TextStyle(color: AppColors.gray400, fontSize: 14)),
                  GestureDetector(
                    onTap: () => context.go('/auth/register'),
                    child: const Text('Kaydol',
                        style: TextStyle(
                            color: AppColors.blue,
                            fontSize: 14,
                            fontWeight: FontWeight.w600)),
                  ),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
