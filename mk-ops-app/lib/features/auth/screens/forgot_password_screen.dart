import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailCtrl = TextEditingController();
  bool _loading = false;
  bool _sent = false;

  Future<void> _submit() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty || !email.contains('@')) return;
    setState(() => _loading = true);
    try {
      await ref.read(supabaseServiceProvider).resetPassword(email);
      setState(() => _sent = true);
    } catch (_) {
      setState(() => _sent = true); // fail silently for security
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.navy,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/auth/login'),
        ),
        title: const Text('Şifre Sıfırla'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: _sent
            ? Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.mark_email_read_outlined,
                      color: AppColors.green, size: 56),
                  const SizedBox(height: 20),
                  const Text('E-posta Gönderildi',
                      style: TextStyle(
                          fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.white)),
                  const SizedBox(height: 10),
                  const Text(
                    'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.gray400, fontSize: 14, height: 1.6),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () => context.go('/auth/login'),
                      child: const Text('Giriş Yap'),
                    ),
                  ),
                ]),
              )
            : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Text(
                  'E-posta adresinizi girin, şifre sıfırlama bağlantısı göndereceğiz.',
                  style: TextStyle(color: AppColors.gray400, fontSize: 14, height: 1.6),
                ),
                const SizedBox(height: 24),
                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  style: const TextStyle(color: AppColors.white),
                  decoration: const InputDecoration(
                    labelText: 'E-posta',
                    prefixIcon: Icon(Icons.email_outlined, color: AppColors.gray400),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _submit,
                    child: _loading
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2))
                        : const Text('Bağlantı Gönder',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ),
              ]),
      ),
    );
  }
}
