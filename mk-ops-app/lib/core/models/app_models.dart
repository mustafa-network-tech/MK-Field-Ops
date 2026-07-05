import 'package:equatable/equatable.dart';

// ─── Company ─────────────────────────────────────────────────────────────────

class Company extends Equatable {
  final String id;
  final String name;
  final String? logoUrl;
  final String languageCode;
  final String? plan;
  final String? subscriptionStatus;
  final String? planStatus;
  final DateTime? trialEndDate;
  final DateTime? planEndDate;
  final int payrollStartDay;
  final String timezone;

  const Company({
    required this.id,
    required this.name,
    this.logoUrl,
    this.languageCode = 'tr',
    this.plan,
    this.subscriptionStatus,
    this.planStatus,
    this.trialEndDate,
    this.planEndDate,
    this.payrollStartDay = 20,
    this.timezone = 'Europe/Istanbul',
  });

  factory Company.fromMap(Map<String, dynamic> map) => Company(
        id: map['id'] as String,
        name: map['name'] as String,
        logoUrl: map['logo_url'] as String?,
        languageCode: (map['language_code'] as String?) ?? 'tr',
        plan: map['plan'] as String?,
        subscriptionStatus: map['subscription_status'] as String?,
        planStatus: map['plan_status'] as String?,
        trialEndDate: map['trial_end_date'] != null
            ? DateTime.tryParse(map['trial_end_date'].toString())
            : null,
        planEndDate: map['plan_end_date'] != null
            ? DateTime.tryParse(map['plan_end_date'].toString())
            : null,
        payrollStartDay: (map['payroll_start_day'] as int?) ?? 20,
        timezone: (map['timezone'] as String?) ?? 'Europe/Istanbul',
      );

  // null veya 'trial' → yeni şirket, aktif sayılır; 'suspended'/'closed' değil
  bool get isActive =>
      subscriptionStatus == null ||
      subscriptionStatus == 'active' ||
      subscriptionStatus == 'trial';
  bool get isSuspended => subscriptionStatus == 'suspended';
  bool get isClosed => subscriptionStatus == 'closed';

  @override
  List<Object?> get props => [id];
}

// ─── Profile ─────────────────────────────────────────────────────────────────

class AppProfile extends Equatable {
  final String id;
  final String? companyId;
  final String role;
  final String fullName;
  final String? email;
  final String roleApprovalStatus;
  final bool canSeePrices;

  const AppProfile({
    required this.id,
    this.companyId,
    required this.role,
    required this.fullName,
    this.email,
    this.roleApprovalStatus = 'pending',
    this.canSeePrices = false,
  });

  factory AppProfile.fromMap(Map<String, dynamic> map) => AppProfile(
        id: map['id'] as String,
        companyId: map['company_id'] as String?,
        role: (map['role'] as String?) ?? 'teamLeader',
        fullName: (map['full_name'] as String?) ?? '',
        email: map['email'] as String?,
        roleApprovalStatus:
            (map['role_approval_status'] as String?) ?? 'pending',
        canSeePrices: (map['can_see_prices'] as bool?) ?? false,
      );

  bool get isCompanyManager => role == 'companyManager';
  bool get isProjectManager => role == 'projectManager';
  bool get isTeamLeader => role == 'teamLeader';
  bool get isSuperAdmin => role == 'superAdmin';
  bool get isManager => isCompanyManager || isProjectManager;
  bool get isApproved => roleApprovalStatus == 'approved';

  String get roleLabel {
    switch (role) {
      case 'companyManager':
        return 'Şirket Yöneticisi';
      case 'projectManager':
        return 'Proje Yöneticisi';
      case 'teamLeader':
        return 'Ekip Lideri';
      case 'superAdmin':
        return 'Süper Admin';
      default:
        return role;
    }
  }

  @override
  List<Object?> get props => [id];
}

// ─── Campaign ────────────────────────────────────────────────────────────────

class Campaign extends Equatable {
  final String id;
  final String companyId;
  final String name;
  final DateTime createdAt;

  const Campaign({
    required this.id,
    required this.companyId,
    required this.name,
    required this.createdAt,
  });

  factory Campaign.fromMap(Map<String, dynamic> map) => Campaign(
        id: map['id'] as String,
        companyId: map['company_id'] as String,
        name: map['name'] as String,
        createdAt: DateTime.parse(map['created_at'].toString()),
      );

  @override
  List<Object?> get props => [id];
}

// ─── Project ─────────────────────────────────────────────────────────────────

class Project extends Equatable {
  final String id;
  final String companyId;
  final String campaignId;
  final int projectYear;
  final String externalProjectId;
  final DateTime receivedDate;
  final String? name;
  final String? description;
  final String status;
  final DateTime? completedAt;
  final DateTime createdAt;

  const Project({
    required this.id,
    required this.companyId,
    required this.campaignId,
    required this.projectYear,
    required this.externalProjectId,
    required this.receivedDate,
    this.name,
    this.description,
    this.status = 'ACTIVE',
    this.completedAt,
    required this.createdAt,
  });

  factory Project.fromMap(Map<String, dynamic> map) => Project(
        id: (map['id'] as String?) ?? '',
        companyId: (map['company_id'] as String?) ?? '',
        campaignId: (map['campaign_id'] as String?) ?? '',
        projectYear: (map['project_year'] as int?) ?? DateTime.now().year,
        externalProjectId: (map['external_project_id'] as String?) ?? '',
        receivedDate: map['received_date'] != null
            ? DateTime.tryParse(map['received_date'].toString()) ?? DateTime.now()
            : DateTime.now(),
        name: map['name'] as String?,
        description: map['description'] as String?,
        status: (map['status'] as String?) ?? 'ACTIVE',
        completedAt: map['completed_at'] != null
            ? DateTime.tryParse(map['completed_at'].toString())
            : null,
        createdAt: map['created_at'] != null
            ? DateTime.tryParse(map['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );

  bool get isActive => status == 'ACTIVE';
  bool get isCompleted => status == 'COMPLETED';
  bool get isArchived => status == 'ARCHIVED';

  String get displayKey => '$projectYear-$externalProjectId';
  String get displayName => name ?? displayKey;

  @override
  List<Object?> get props => [id];
}

// ─── Team ────────────────────────────────────────────────────────────────────

class Team extends Equatable {
  final String id;
  final String companyId;
  final String code;
  final String? description;
  final double percentage;
  final String? leaderId;
  final List<String> memberIds;
  final String approvalStatus;
  final DateTime? wipedAt;
  final DateTime createdAt;

  const Team({
    required this.id,
    required this.companyId,
    required this.code,
    this.description,
    this.percentage = 70.0,
    this.leaderId,
    this.memberIds = const [],
    this.approvalStatus = 'pending',
    this.wipedAt,
    required this.createdAt,
  });

  factory Team.fromMap(Map<String, dynamic> map) => Team(
        id: (map['id'] as String?) ?? '',
        companyId: (map['company_id'] as String?) ?? '',
        code: (map['code'] as String?) ?? '',
        description: map['description'] as String?,
        percentage: double.tryParse(map['percentage']?.toString() ?? '70') ?? 70.0,
        leaderId: map['leader_id'] as String?,
        memberIds: (map['member_ids'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            [],
        approvalStatus: (map['approval_status'] as String?) ?? 'pending',
        wipedAt: map['wiped_at'] != null
            ? DateTime.tryParse(map['wiped_at'].toString())
            : null,
        createdAt: map['created_at'] != null
            ? DateTime.tryParse(map['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );

  bool get isActive => wipedAt == null && approvalStatus == 'approved';

  @override
  List<Object?> get props => [id];
}

// ─── WorkItem ────────────────────────────────────────────────────────────────

class WorkItem extends Equatable {
  final String id;
  final String companyId;
  final String code;
  final String unitType;
  final double unitPrice;
  final String description;

  const WorkItem({
    required this.id,
    required this.companyId,
    required this.code,
    required this.unitType,
    required this.unitPrice,
    this.description = '',
  });

  factory WorkItem.fromMap(Map<String, dynamic> map) => WorkItem(
        id: (map['id'] as String?) ?? '',
        companyId: (map['company_id'] as String?) ?? '',
        code: (map['code'] as String?) ?? '',
        unitType: (map['unit_type'] as String?) ?? '',
        unitPrice:
            double.tryParse(map['unit_price']?.toString() ?? '0') ?? 0.0,
        description: (map['description'] as String?) ?? '',
      );

  @override
  List<Object?> get props => [id];
}

// ─── Job ─────────────────────────────────────────────────────────────────────

class Job extends Equatable {
  final String id;
  final String companyId;
  final DateTime jobDate;
  final String? projectId;
  final String teamId;
  final String workItemId;
  final double quantity;
  final List<String> equipmentIds;
  final String notes;
  final String status;
  final bool stockDeducted;
  final String? approvedBy;
  final DateTime? approvedAt;
  final String? rejectedBy;
  final String createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? payrollPeriodId;
  final String? rejectionReason;

  // Joined fields (populated from joins)
  final Project? project;
  final Team? team;
  final WorkItem? workItem;

  const Job({
    required this.id,
    required this.companyId,
    required this.jobDate,
    this.projectId,
    required this.teamId,
    required this.workItemId,
    required this.quantity,
    this.equipmentIds = const [],
    this.notes = '',
    this.status = 'draft',
    this.stockDeducted = false,
    this.approvedBy,
    this.approvedAt,
    this.rejectedBy,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
    this.payrollPeriodId,
    this.rejectionReason,
    this.project,
    this.team,
    this.workItem,
  });

  factory Job.fromMap(Map<String, dynamic> map) => Job(
        id: (map['id'] as String?) ?? '',
        companyId: (map['company_id'] as String?) ?? '',
        jobDate: map['job_date'] != null
            ? DateTime.tryParse(map['job_date'].toString()) ?? DateTime.now()
            : DateTime.now(),
        projectId: map['project_id'] as String?,
        teamId: (map['team_id'] as String?) ?? '',
        workItemId: (map['work_item_id'] as String?) ?? '',
        quantity:
            double.tryParse(map['quantity']?.toString() ?? '0') ?? 0.0,
        equipmentIds: (map['equipment_ids'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            [],
        notes: (map['notes'] as String?) ?? '',
        status: (map['status'] as String?) ?? 'draft',
        stockDeducted: (map['stock_deducted'] as bool?) ?? false,
        approvedBy: map['approved_by'] as String?,
        approvedAt: map['approved_at'] != null
            ? DateTime.tryParse(map['approved_at'].toString())
            : null,
        rejectedBy: map['rejected_by'] as String?,
        createdBy: (map['created_by'] as String?) ?? '',
        createdAt: map['created_at'] != null
            ? DateTime.tryParse(map['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
        updatedAt: map['updated_at'] != null
            ? DateTime.tryParse(map['updated_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
        payrollPeriodId: map['payroll_period_id'] as String?,
        rejectionReason: map['rejection_reason'] as String?,
        project: (map['projects'] is Map)
            ? Project.fromMap(map['projects'] as Map<String, dynamic>)
            : null,
        team: (map['teams'] is Map)
            ? Team.fromMap(map['teams'] as Map<String, dynamic>)
            : null,
        workItem: (map['work_items'] is Map)
            ? WorkItem.fromMap(map['work_items'] as Map<String, dynamic>)
            : null,
      );

  bool get isDraft => status == 'draft';
  bool get isSubmitted => status == 'submitted';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  double get totalValue => quantity * (workItem?.unitPrice ?? 0);

  String get statusLabel {
    switch (status) {
      case 'draft':
        return 'Taslak';
      case 'submitted':
        return 'Onay Bekliyor';
      case 'approved':
        return 'Onaylandı';
      case 'rejected':
        return 'Reddedildi';
      default:
        return status;
    }
  }

  @override
  List<Object?> get props => [id, status, updatedAt];
}

// ─── PayrollPeriod ───────────────────────────────────────────────────────────

class PayrollPeriod extends Equatable {
  final String id;
  final String companyId;
  final DateTime startDate;
  final DateTime endDate;
  final bool isLocked;
  final DateTime createdAt;

  const PayrollPeriod({
    required this.id,
    required this.companyId,
    required this.startDate,
    required this.endDate,
    required this.isLocked,
    required this.createdAt,
  });

  factory PayrollPeriod.fromMap(Map<String, dynamic> map) => PayrollPeriod(
        id: map['id'] as String,
        companyId: map['company_id'] as String,
        startDate: DateTime.parse(map['start_date'].toString()),
        endDate: DateTime.parse(map['end_date'].toString()),
        isLocked: (map['is_locked'] as bool?) ?? false,
        createdAt: DateTime.parse(map['created_at'].toString()),
      );

  bool get isActive {
    final now = DateTime.now();
    return !isLocked &&
        now.isAfter(startDate) &&
        now.isBefore(endDate.add(const Duration(days: 1)));
  }

  @override
  List<Object?> get props => [id];
}

// ─── Notification ────────────────────────────────────────────────────────────

class AppNotification extends Equatable {
  final String id;
  final String companyId;
  final String type;
  final String titleKey;
  final Map<String, dynamic> meta;
  final DateTime createdAt;
  final bool isRead;

  const AppNotification({
    required this.id,
    required this.companyId,
    required this.type,
    required this.titleKey,
    required this.meta,
    required this.createdAt,
    this.isRead = false,
  });

  factory AppNotification.fromMap(Map<String, dynamic> map,
      {bool isRead = false}) =>
      AppNotification(
        id: (map['id'] as String?) ?? '',
        companyId: (map['company_id'] as String?) ?? '',
        type: (map['type'] as String?) ?? '',
        titleKey: (map['title_key'] as String?) ?? '',
        meta: (map['meta'] as Map<String, dynamic>?) ?? {},
        createdAt: map['created_at'] != null
            ? DateTime.tryParse(map['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
        isRead: isRead,
      );

  String get displayTitle {
    switch (type) {
      case 'pm_job_approved':
        return 'İş Onaylandı';
      case 'pm_team_created':
        return 'Yeni Ekip Oluşturuldu';
      case 'pm_team_approved':
        return 'Ekip Onaylandı';
      case 'new_user_pending':
        return 'Yeni Kullanıcı Onay Bekliyor';
      default:
        return 'Bildirim';
    }
  }

  @override
  List<Object?> get props => [id, isRead];
}

// ─── PayrollSummary ──────────────────────────────────────────────────────────

class PayrollSummary {
  final double totalGross;
  final double teamShare;
  final double companyShare;
  final int approvedJobCount;
  final int pendingJobCount;
  final double previousPeriodTotal;

  const PayrollSummary({
    required this.totalGross,
    required this.teamShare,
    required this.companyShare,
    required this.approvedJobCount,
    required this.pendingJobCount,
    this.previousPeriodTotal = 0,
  });

  double get changePercent {
    if (previousPeriodTotal == 0) return 0;
    return ((totalGross - previousPeriodTotal) / previousPeriodTotal) * 100;
  }

  bool get isIncrease => totalGross >= previousPeriodTotal;
}

// ─── DashboardStats ──────────────────────────────────────────────────────────

class DashboardStats {
  final int todayJobCount;
  final int pendingApprovalCount;
  final double currentPeriodEarnings;
  final int activeProjectCount;
  final int unreadNotificationCount;

  const DashboardStats({
    this.todayJobCount = 0,
    this.pendingApprovalCount = 0,
    this.currentPeriodEarnings = 0,
    this.activeProjectCount = 0,
    this.unreadNotificationCount = 0,
  });
}
