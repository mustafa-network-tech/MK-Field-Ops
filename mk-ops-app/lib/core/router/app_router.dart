import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/providers.dart';
import '../../features/auth/screens/splash_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';
import '../../features/auth/screens/forgot_password_screen.dart';
import '../../features/auth/screens/no_company_screen.dart';
import '../../features/auth/screens/pending_approval_screen.dart';
import '../../features/dashboard/screens/dashboard_screen.dart';
import '../../features/jobs/screens/job_entry_screen.dart';
import '../../features/jobs/screens/jobs_list_screen.dart';
import '../../features/jobs/screens/job_detail_screen.dart';
import '../../features/approvals/screens/approvals_screen.dart';
import '../../features/projects/screens/projects_screen.dart';
import '../../features/teams/screens/teams_screen.dart';
import '../../features/payroll/screens/payroll_screen.dart';
import '../../features/reports/screens/reports_screen.dart';
import '../../features/notifications/screens/notifications_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../shared/widgets/main_scaffold.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isLoading = authState.isLoading;
      if (isLoading) return '/splash';

      final user = authState.valueOrNull?.session?.user;
      final isLoggedIn = user != null;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');
      final isSplash = state.matchedLocation == '/splash';

      if (isSplash) return null;
      if (!isLoggedIn && !isAuthRoute) return '/auth/login';
      if (isLoggedIn && isAuthRoute) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),

      // Auth routes
      GoRoute(
        path: '/auth',
        redirect: (_, __) => '/auth/login',
        routes: [
          GoRoute(
              path: 'login',
              builder: (_, __) => const LoginScreen()),
          GoRoute(
              path: 'register',
              builder: (_, __) => const RegisterScreen()),
          GoRoute(
              path: 'forgot-password',
              builder: (_, __) => const ForgotPasswordScreen()),
          GoRoute(
              path: 'no-company',
              builder: (_, __) => const NoCompanyScreen()),
          GoRoute(
              path: 'pending',
              builder: (_, __) => const PendingApprovalScreen()),
        ],
      ),

      // Main app (with bottom nav)
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(
              path: '/dashboard',
              builder: (_, __) => const DashboardScreen()),
          GoRoute(
              path: '/job-entry',
              builder: (_, __) => const JobEntryScreen()),
          GoRoute(
              path: '/jobs',
              builder: (_, __) => const JobsListScreen()),
          GoRoute(
              path: '/jobs/:id',
              builder: (_, state) =>
                  JobDetailScreen(jobId: state.pathParameters['id']!)),
          GoRoute(
              path: '/approvals',
              builder: (_, __) => const ApprovalsScreen()),
          GoRoute(
              path: '/projects',
              builder: (_, __) => const ProjectsScreen()),
          GoRoute(
              path: '/teams',
              builder: (_, __) => const TeamsScreen()),
          GoRoute(
              path: '/payroll',
              builder: (_, __) => const PayrollScreen()),
          GoRoute(
              path: '/reports',
              builder: (_, __) => const ReportsScreen()),
          GoRoute(
              path: '/notifications',
              builder: (_, __) => const NotificationsScreen()),
          GoRoute(
              path: '/profile',
              builder: (_, __) => const ProfileScreen()),
        ],
      ),
    ],
  );
});
