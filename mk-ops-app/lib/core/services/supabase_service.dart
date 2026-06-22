import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/app_models.dart';
import '../constants/app_constants.dart';

class SupabaseService {
  SupabaseService._();
  static final SupabaseService instance = SupabaseService._();

  SupabaseClient get client => Supabase.instance.client;
  User? get currentUser => client.auth.currentUser;
  String? get currentUserId => currentUser?.id;

  // ── Auth ────────────────────────────────────────────────────────────────────

  Future<AuthResponse> signIn(String email, String password) =>
      client.auth.signInWithPassword(email: email, password: password);

  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
  }) =>
      client.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName},
      );

  Future<void> signOut() => client.auth.signOut();

  Future<void> resetPassword(String email) =>
      client.auth.resetPasswordForEmail(email);

  Stream<AuthState> get authStream => client.auth.onAuthStateChange;

  // ── Profile ─────────────────────────────────────────────────────────────────

  Future<AppProfile?> fetchProfile(String userId) async {
    final data = await client
        .from(AppConstants.tableProfiles)
        .select()
        .eq('id', userId)
        .maybeSingle();
    if (data == null) return null;
    return AppProfile.fromMap(data);
  }

  Future<AppProfile?> fetchCurrentProfile() async {
    if (currentUserId == null) return null;
    return fetchProfile(currentUserId!);
  }

  Future<void> upsertProfile(Map<String, dynamic> data) async {
    await client
        .from(AppConstants.tableProfiles)
        .upsert(data, onConflict: 'id');
  }

  // ── Company ─────────────────────────────────────────────────────────────────

  Future<Company?> fetchCompany(String companyId) async {
    final data = await client
        .from(AppConstants.tableCompanies)
        .select()
        .eq('id', companyId)
        .maybeSingle();
    if (data == null) return null;
    return Company.fromMap(data);
  }

  // ── Jobs ────────────────────────────────────────────────────────────────────

  Future<List<Job>> fetchJobs({
    required String companyId,
    String? teamId,
    String? status,
    String? projectId,
    DateTime? dateFrom,
    DateTime? dateTo,
    int limit = 50,
    int offset = 0,
  }) async {
    var query = client
        .from(AppConstants.tableJobs)
        .select('''
          *,
          projects(id, name, external_project_id, project_year, status),
          teams(id, code, description, percentage),
          work_items(id, code, unit_type, unit_price, description)
        ''')
        .eq('company_id', companyId)
        .order('job_date', ascending: false)
        .order('created_at', ascending: false)
        .range(offset, offset + limit - 1);

    if (teamId != null) query = query.eq('team_id', teamId);
    if (status != null) query = query.eq('status', status);
    if (projectId != null) query = query.eq('project_id', projectId);
    if (dateFrom != null) {
      query = query.gte('job_date', dateFrom.toIso8601String().substring(0, 10));
    }
    if (dateTo != null) {
      query = query.lte('job_date', dateTo.toIso8601String().substring(0, 10));
    }

    final data = await query;
    return data.map((e) => Job.fromMap(e)).toList();
  }

  Future<Job?> fetchJob(String jobId) async {
    final data = await client
        .from(AppConstants.tableJobs)
        .select('''
          *,
          projects(id, name, external_project_id, project_year, status),
          teams(id, code, description, percentage),
          work_items(id, code, unit_type, unit_price, description)
        ''')
        .eq('id', jobId)
        .maybeSingle();
    if (data == null) return null;
    return Job.fromMap(data);
  }

  Future<String> createJob(Map<String, dynamic> data) async {
    final result = await client
        .from(AppConstants.tableJobs)
        .insert(data)
        .select('id')
        .single();
    return result['id'] as String;
  }

  Future<void> updateJob(String jobId, Map<String, dynamic> data) async {
    await client
        .from(AppConstants.tableJobs)
        .update({...data, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', jobId);
  }

  Future<void> submitJob(String jobId) async {
    await updateJob(jobId, {'status': AppConstants.jobSubmitted});
  }

  Future<void> approveJob(String jobId, String approvedBy) async {
    await updateJob(jobId, {
      'status': AppConstants.jobApproved,
      'approved_by': approvedBy,
      'approved_at': DateTime.now().toIso8601String(),
    });
  }

  Future<void> rejectJob(
      String jobId, String rejectedBy, String reason) async {
    await updateJob(jobId, {
      'status': AppConstants.jobRejected,
      'rejected_by': rejectedBy,
      'rejection_reason': reason,
    });
  }

  Future<void> deleteJob(String jobId) async {
    await client.from(AppConstants.tableJobs).delete().eq('id', jobId);
  }

  // ── Projects ────────────────────────────────────────────────────────────────

  Future<List<Project>> fetchProjects({
    required String companyId,
    String? status,
  }) async {
    var query = client
        .from(AppConstants.tableProjects)
        .select()
        .eq('company_id', companyId)
        .order('created_at', ascending: false);

    if (status != null) query = query.eq('status', status);

    final data = await query;
    return data.map((e) => Project.fromMap(e)).toList();
  }

  // ── Teams ───────────────────────────────────────────────────────────────────

  Future<List<Team>> fetchTeams({
    required String companyId,
    String? leaderId,
  }) async {
    var query = client
        .from(AppConstants.tableTeams)
        .select()
        .eq('company_id', companyId)
        .is_('wiped_at', null)
        .eq('approval_status', 'approved')
        .order('code');

    if (leaderId != null) query = query.eq('leader_id', leaderId);

    final data = await query;
    return data.map((e) => Team.fromMap(e)).toList();
  }

  // ── WorkItems ───────────────────────────────────────────────────────────────

  Future<List<WorkItem>> fetchWorkItems(String companyId) async {
    final data = await client
        .from(AppConstants.tableWorkItems)
        .select()
        .eq('company_id', companyId)
        .order('code');
    return data.map((e) => WorkItem.fromMap(e)).toList();
  }

  // ── PayrollPeriods ──────────────────────────────────────────────────────────

  Future<List<PayrollPeriod>> fetchPayrollPeriods(String companyId,
      {int limit = 12}) async {
    final data = await client
        .from(AppConstants.tablePayrollPeriods)
        .select()
        .eq('company_id', companyId)
        .order('start_date', ascending: false)
        .limit(limit);
    return data.map((e) => PayrollPeriod.fromMap(e)).toList();
  }

  Future<PayrollPeriod?> fetchActivePeriod(String companyId) async {
    final periods = await fetchPayrollPeriods(companyId, limit: 3);
    final now = DateTime.now();
    try {
      return periods.firstWhere(
        (p) =>
            !p.isLocked &&
            (now.isAfter(p.startDate) ||
                now.isAtSameMomentAs(p.startDate)) &&
            (now.isBefore(p.endDate.add(const Duration(days: 1)))),
      );
    } catch (_) {
      return periods.isNotEmpty ? periods.first : null;
    }
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  Future<List<AppNotification>> fetchNotifications(
      String companyId, String userId,
      {int limit = 30}) async {
    final data = await client
        .from(AppConstants.tableNotifications)
        .select('''
          *,
          notification_reads!left(user_id)
        ''')
        .eq('company_id', companyId)
        .order('created_at', ascending: false)
        .limit(limit);

    return data.map((e) {
      final reads = e['notification_reads'] as List<dynamic>? ?? [];
      final isRead =
          reads.any((r) => (r as Map)['user_id'] == userId);
      return AppNotification.fromMap(e, isRead: isRead);
    }).toList();
  }

  Future<void> markNotificationRead(
      String notificationId, String userId) async {
    await client.from(AppConstants.tableNotificationReads).upsert({
      'notification_id': notificationId,
      'user_id': userId,
      'read_at': DateTime.now().toIso8601String(),
    }, onConflict: 'notification_id,user_id');
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  Future<DashboardStats> fetchDashboardStats({
    required String companyId,
    required AppProfile profile,
    PayrollPeriod? activePeriod,
  }) async {
    final today = DateTime.now();
    final todayStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    // Today's jobs
    var todayQuery = client
        .from(AppConstants.tableJobs)
        .select('id', const FetchOptions(count: CountOption.exact))
        .eq('company_id', companyId)
        .eq('job_date', todayStr);
    if (profile.isTeamLeader) {
      final teams = await fetchTeams(
          companyId: companyId, leaderId: profile.id);
      if (teams.isNotEmpty) {
        todayQuery = todayQuery.inFilter(
            'team_id', teams.map((t) => t.id).toList());
      }
    }
    final todayResult = await todayQuery;

    // Pending approvals
    var pendingQuery = client
        .from(AppConstants.tableJobs)
        .select('id', const FetchOptions(count: CountOption.exact))
        .eq('company_id', companyId)
        .eq('status', AppConstants.jobSubmitted);
    if (profile.isTeamLeader) {
      final teams = await fetchTeams(
          companyId: companyId, leaderId: profile.id);
      if (teams.isNotEmpty) {
        pendingQuery = pendingQuery.inFilter(
            'team_id', teams.map((t) => t.id).toList());
      }
    }
    final pendingResult = await pendingQuery;

    // Active projects
    final projectsResult = await client
        .from(AppConstants.tableProjects)
        .select('id', const FetchOptions(count: CountOption.exact))
        .eq('company_id', companyId)
        .eq('status', AppConstants.projectActive);

    // Unread notifications
    final notifications =
        await fetchNotifications(companyId, profile.id, limit: 50);
    final unreadCount = notifications.where((n) => !n.isRead).length;

    // Period earnings (approved jobs)
    double earnings = 0;
    if (activePeriod != null) {
      var earningsQuery = client
          .from(AppConstants.tableJobs)
          .select('''
            quantity,
            work_items(unit_price)
          ''')
          .eq('company_id', companyId)
          .eq('status', AppConstants.jobApproved)
          .eq('payroll_period_id', activePeriod.id);

      if (profile.isTeamLeader) {
        final teams = await fetchTeams(
            companyId: companyId, leaderId: profile.id);
        if (teams.isNotEmpty) {
          earningsQuery = earningsQuery.inFilter(
              'team_id', teams.map((t) => t.id).toList());
        }
      }

      final earningsData = await earningsQuery;
      for (final row in earningsData) {
        final qty = double.tryParse(row['quantity'].toString()) ?? 0;
        final price =
            double.tryParse(row['work_items']?['unit_price']?.toString() ?? '0') ?? 0;
        earnings += qty * price;
      }
    }

    return DashboardStats(
      todayJobCount: todayResult.count ?? 0,
      pendingApprovalCount: pendingResult.count ?? 0,
      currentPeriodEarnings: earnings,
      activeProjectCount: projectsResult.count ?? 0,
      unreadNotificationCount: unreadCount,
    );
  }

  // ── Payroll Summary ─────────────────────────────────────────────────────────

  Future<PayrollSummary> fetchPayrollSummary({
    required String companyId,
    required AppProfile profile,
    String? periodId,
    String? teamId,
    DateTime? dateFrom,
    DateTime? dateTo,
  }) async {
    var query = client
        .from(AppConstants.tableJobs)
        .select('''
          quantity, status,
          teams(percentage),
          work_items(unit_price)
        ''')
        .eq('company_id', companyId);

    if (periodId != null) query = query.eq('payroll_period_id', periodId);
    if (teamId != null) query = query.eq('team_id', teamId);
    if (profile.isTeamLeader) {
      final teams =
          await fetchTeams(companyId: companyId, leaderId: profile.id);
      if (teams.isNotEmpty) {
        query =
            query.inFilter('team_id', teams.map((t) => t.id).toList());
      }
    }
    if (dateFrom != null) {
      query = query.gte(
          'job_date', dateFrom.toIso8601String().substring(0, 10));
    }
    if (dateTo != null) {
      query = query.lte(
          'job_date', dateTo.toIso8601String().substring(0, 10));
    }

    final data = await query;

    double totalGross = 0;
    double teamShare = 0;
    int approvedCount = 0;
    int pendingCount = 0;

    for (final row in data) {
      final qty = double.tryParse(row['quantity']?.toString() ?? '0') ?? 0;
      final price = double.tryParse(
              row['work_items']?['unit_price']?.toString() ?? '0') ??
          0;
      final pct = double.tryParse(
              row['teams']?['percentage']?.toString() ?? '0') ??
          0;
      final status = row['status'] as String? ?? '';

      if (status == 'approved') {
        final jobTotal = qty * price;
        totalGross += jobTotal;
        teamShare += jobTotal * (pct / 100);
        approvedCount++;
      } else if (status == 'submitted') {
        pendingCount++;
      }
    }

    return PayrollSummary(
      totalGross: totalGross,
      teamShare: teamShare,
      companyShare: totalGross - teamShare,
      approvedJobCount: approvedCount,
      pendingJobCount: pendingCount,
    );
  }
}
