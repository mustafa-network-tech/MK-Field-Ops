import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';

class MainScaffold extends ConsumerWidget {
  final Widget child;
  const MainScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    final profile = profileAsync.valueOrNull;

    final location = GoRouterState.of(context).matchedLocation;

    final isManager = profile?.isManager ?? false;

    final navItems = _buildNavItems(isManager);
    final paths = navItems.map((e) => e.path).toList();

    int currentIndex = 0;
    for (int i = 0; i < paths.length; i++) {
      if (location.startsWith(paths[i])) {
        currentIndex = i;
        break;
      }
    }

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) => context.go(paths[i]),
        destinations: navItems
            .map((item) => NavigationDestination(
                  icon: Icon(item.icon),
                  selectedIcon: Icon(item.activeIcon),
                  label: item.label,
                ))
            .toList(),
      ),
    );
  }

  List<_NavItem> _buildNavItems(bool isManager) {
    final base = [
      _NavItem('/dashboard', 'Ana Sayfa', Icons.home_outlined, Icons.home),
      _NavItem('/job-entry', 'İş Gir', Icons.add_circle_outline, Icons.add_circle),
      _NavItem('/jobs', 'İşlerim', Icons.work_outline, Icons.work),
      _NavItem('/payroll', 'Hakediş', Icons.account_balance_wallet_outlined,
          Icons.account_balance_wallet),
      _NavItem('/profile', 'Profil', Icons.person_outline, Icons.person),
    ];

    return base;
  }
}

class _NavItem {
  final String path;
  final String label;
  final IconData icon;
  final IconData activeIcon;
  const _NavItem(this.path, this.label, this.icon, this.activeIcon);
}
