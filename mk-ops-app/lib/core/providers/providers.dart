import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/app_models.dart';
import '../services/supabase_service.dart';

// ── Supabase service ─────────────────────────────────────────────────────────

final supabaseServiceProvider = Provider<SupabaseService>(
  (_) => SupabaseService.instance,
);

// ── Auth state ───────────────────────────────────────────────────────────────

final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(supabaseServiceProvider).authStream;
});

final currentUserProvider = Provider<User?>((ref) {
  return ref.watch(supabaseServiceProvider).currentUser;
});

// ── Profile ──────────────────────────────────────────────────────────────────

final profileProvider =
    StateNotifierProvider<ProfileNotifier, AsyncValue<AppProfile?>>((ref) {
  return ProfileNotifier(ref.watch(supabaseServiceProvider));
});

class ProfileNotifier extends StateNotifier<AsyncValue<AppProfile?>> {
  ProfileNotifier(this._svc) : super(const AsyncValue.loading()) {
    load();
  }

  final SupabaseService _svc;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final profile = await _svc.fetchCurrentProfile();
      state = AsyncValue.data(profile);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> reload() => load();
}

// ── Company ──────────────────────────────────────────────────────────────────

final companyProvider =
    StateNotifierProvider<CompanyNotifier, AsyncValue<Company?>>((ref) {
  return CompanyNotifier(ref.watch(supabaseServiceProvider));
});

class CompanyNotifier extends StateNotifier<AsyncValue<Company?>> {
  CompanyNotifier(this._svc) : super(const AsyncValue.data(null));

  final SupabaseService _svc;

  Future<void> load(String companyId) async {
    state = const AsyncValue.loading();
    try {
      final company = await _svc.fetchCompany(companyId);
      state = AsyncValue.data(company);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void clear() => state = const AsyncValue.data(null);
}

// ── Active payroll period ────────────────────────────────────────────────────

final activePeriodProvider =
    FutureProvider.family<PayrollPeriod?, String>((ref, companyId) async {
  return ref.watch(supabaseServiceProvider).fetchActivePeriod(companyId);
});

// ── Projects ─────────────────────────────────────────────────────────────────

final projectsProvider =
    FutureProvider.family<List<Project>, String>((ref, companyId) async {
  return ref.watch(supabaseServiceProvider).fetchProjects(
        companyId: companyId,
        status: 'ACTIVE',
      );
});

final allProjectsProvider =
    FutureProvider.family<List<Project>, String>((ref, companyId) async {
  return ref.watch(supabaseServiceProvider).fetchProjects(
        companyId: companyId,
      );
});

// ── Teams ────────────────────────────────────────────────────────────────────

final teamsProvider =
    FutureProvider.family<List<Team>, String>((ref, companyId) async {
  return ref.watch(supabaseServiceProvider).fetchTeams(companyId: companyId);
});

// ── WorkItems ────────────────────────────────────────────────────────────────

final workItemsProvider =
    FutureProvider.family<List<WorkItem>, String>((ref, companyId) async {
  return ref.watch(supabaseServiceProvider).fetchWorkItems(companyId);
});

// ── Notifications ────────────────────────────────────────────────────────────

final notificationsProvider = FutureProvider.family<List<AppNotification>,
    ({String companyId, String userId})>((ref, args) async {
  return ref
      .watch(supabaseServiceProvider)
      .fetchNotifications(args.companyId, args.userId);
});

// ── Dashboard stats ──────────────────────────────────────────────────────────

final dashboardStatsProvider =
    FutureProvider.family<DashboardStats, AppProfile>((ref, profile) async {
  if (profile.companyId == null) return const DashboardStats();
  final period = await ref
      .watch(activePeriodProvider(profile.companyId!).future);
  return ref.watch(supabaseServiceProvider).fetchDashboardStats(
        companyId: profile.companyId!,
        profile: profile,
        activePeriod: period,
      );
});

// ── Payroll summary ──────────────────────────────────────────────────────────

class PayrollParams {
  final String companyId;
  final AppProfile profile;
  final String? periodId;
  final String? teamId;

  const PayrollParams({
    required this.companyId,
    required this.profile,
    this.periodId,
    this.teamId,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PayrollParams &&
          companyId == other.companyId &&
          profile == other.profile &&
          periodId == other.periodId &&
          teamId == other.teamId;

  @override
  int get hashCode =>
      Object.hash(companyId, profile, periodId, teamId);
}

final payrollSummaryProvider =
    FutureProvider.family<PayrollSummary, PayrollParams>((ref, params) async {
  return ref.watch(supabaseServiceProvider).fetchPayrollSummary(
        companyId: params.companyId,
        profile: params.profile,
        periodId: params.periodId,
        teamId: params.teamId,
      );
});

// ── Jobs ─────────────────────────────────────────────────────────────────────

class JobsParams {
  final String companyId;
  final String? teamId;
  final String? status;
  final String? projectId;
  final DateTime? dateFrom;
  final DateTime? dateTo;

  const JobsParams({
    required this.companyId,
    this.teamId,
    this.status,
    this.projectId,
    this.dateFrom,
    this.dateTo,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is JobsParams &&
          companyId == other.companyId &&
          teamId == other.teamId &&
          status == other.status &&
          projectId == other.projectId &&
          dateFrom == other.dateFrom &&
          dateTo == other.dateTo;

  @override
  int get hashCode =>
      Object.hash(companyId, teamId, status, projectId, dateFrom, dateTo);
}

final jobsProvider =
    FutureProvider.family<List<Job>, JobsParams>((ref, params) async {
  return ref.watch(supabaseServiceProvider).fetchJobs(
        companyId: params.companyId,
        teamId: params.teamId,
        status: params.status,
        projectId: params.projectId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      );
});

// ── Pending approvals ────────────────────────────────────────────────────────

final pendingApprovalsProvider =
    FutureProvider.family<List<Job>, String>((ref, companyId) async {
  return ref.watch(supabaseServiceProvider).fetchJobs(
        companyId: companyId,
        status: 'submitted',
        limit: 100,
      );
});
