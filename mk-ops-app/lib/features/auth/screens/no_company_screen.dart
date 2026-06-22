import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';

class NoCompanyScreen extends ConsumerWidget {
  const NoCompanyScreen({super.key});

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
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.orange.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.orange.withOpacity(0.3)),
                  ),
                  child: const Icon(Icons.business_outlined, color: AppColors.orange, size: 44),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'Şirket hesabınız bulunmuyor',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.white),
              ),
              const SizedBox(height: 12),
              const Text(
                'MK OPS şirketlere özel bir saha operasyon yönetim sistemidir. Sistemi kullanmak için şirket hesabınızın oluşturulması gerekir.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: AppColors.gray400, height: 1.65),
              ),
              const Spacer(),
              _ActionButton(
                icon: Icons.play_circle_outline,
                label: 'Web Demoyu İncele',
                color: AppColors.blue,
                onTap: () => launchUrl(Uri.parse(AppConstants.demoUrl)),
              ),
              const SizedBox(height: 12),
              _ActionButton(
                icon: Icons.business_center_outlined,
                label: 'Şirket Hesabı Başvurusu Yap',
                color: AppColors.green,
                onTap: () => launchUrl(Uri.parse(AppConstants.websiteUrl)),
              ),
              const SizedBox(height: 12),
              _ActionButton(
                icon: Icons.chat_outlined,
                label: 'WhatsApp ile İletişime Geç',
                color: const Color(0xFF25D366),
                onTap: () => launchUrl(
                    Uri.parse('https://wa.me/${AppConstants.whatsappNumber}')),
              ),
              const SizedBox(height: 24),
              TextButton(
                onPressed: () async {
                  await ref.read(supabaseServiceProvider).signOut();
                  if (context.mounted) context.go('/auth/login');
                },
                child: const Text('Çıkış Yap',
                    style: TextStyle(color: AppColors.gray400, fontSize: 14)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: OutlinedButton.icon(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color.withOpacity(0.4)),
        ),
        icon: Icon(icon, size: 20),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
    );
  }
}
