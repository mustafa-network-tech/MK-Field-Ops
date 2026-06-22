import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/theme/app_theme.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fade;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _scale = Tween<double>(begin: 0.85, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack));
    _ctrl.forward();
    _navigate();
  }

  Future<void> _navigate() async {
    await Future.delayed(const Duration(milliseconds: 1800));
    if (!mounted) return;
    final authState = ref.read(authStateProvider).valueOrNull;
    final user = authState?.session?.user;
    if (user == null) {
      context.go('/auth/login');
    } else {
      final profile = await ref.read(supabaseServiceProvider).fetchCurrentProfile();
      if (profile == null || profile.companyId == null) {
        context.go('/auth/no-company');
      } else if (!profile.isApproved) {
        context.go('/auth/pending');
      } else {
        final company = await ref.read(supabaseServiceProvider).fetchCompany(profile.companyId!);
        if (company == null || !company.isActive) {
          context.go('/auth/no-company');
        } else {
          context.go('/dashboard');
        }
      }
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.navy,
      body: Center(
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: AppColors.blue.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                        color: AppColors.blue.withOpacity(0.3), width: 1.5),
                  ),
                  child: const Icon(Icons.bolt_rounded,
                      color: AppColors.blue, size: 52),
                ),
                const SizedBox(height: 20),
                const Text('MK OPS',
                    style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: AppColors.white,
                        letterSpacing: 2)),
                const SizedBox(height: 6),
                const Text('Saha Operasyon Yönetimi',
                    style: TextStyle(
                        fontSize: 13,
                        color: AppColors.gray400,
                        letterSpacing: 0.5)),
                const SizedBox(height: 48),
                SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.blue.withOpacity(0.6),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
