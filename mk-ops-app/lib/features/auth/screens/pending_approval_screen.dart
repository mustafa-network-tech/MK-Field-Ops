import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';

class PendingApprovalScreen extends ConsumerWidget {
  const PendingApprovalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.navy,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Center(
                child: Container(
                  width: 80, height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.orange.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.orange.withOpacity(0.3)),
                  ),
                  child: const Icon(Icons.hourglass_empty, color: AppColors.orange, size: 40),
                ),
              ),
              const SizedBox(height: 28),
              const Text('Onay Bekleniyor',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.white)),
              const SizedBox(height: 12),
              const Text(
                'Hesabınız şirket yöneticisi tarafından henüz onaylanmadı. Onaylandıktan sonra sisteme giriş yapabilirsiniz.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: AppColors.gray400, height: 1.65),
              ),
              const Spacer(),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: () async {
                    final svc = ref.read(supabaseServiceProvider);
                    final profile = await svc.fetchCurrentProfile();
                    if (!context.mounted) return;
                    if (profile?.isApproved == true) {
                      context.go('/dashboard');
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Henüz onaylanmadınız.')),
                      );
                    }
                  },
                  child: const Text('Durumu Kontrol Et'),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () async {
                  await ref.read(supabaseServiceProvider).signOut();
                  if (context.mounted) context.go('/auth/login');
                },
                child: const Text('Çıkış Yap',
                    style: TextStyle(color: AppColors.gray400)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
