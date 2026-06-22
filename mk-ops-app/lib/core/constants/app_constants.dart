class AppConstants {
  AppConstants._();

  static const String appName = 'MK OPS';
  static const String packageName = 'com.mkdigitalsystems.mkops';
  static const String demoUrl = 'https://mkops-demo.vercel.app/login';
  static const String websiteUrl = 'https://mustafaoner.net';
  static const String whatsappNumber = '905456597551';

  // Supabase tables
  static const String tableCompanies = 'companies';
  static const String tableProfiles = 'profiles';
  static const String tableCampaigns = 'campaigns';
  static const String tableProjects = 'projects';
  static const String tableTeams = 'teams';
  static const String tableJobs = 'jobs';
  static const String tableWorkItems = 'work_items';
  static const String tableEquipment = 'equipment';
  static const String tablePayrollPeriods = 'payroll_periods';
  static const String tableNotifications = 'notifications';
  static const String tableNotificationReads = 'notification_reads';

  // Job statuses
  static const String jobDraft = 'draft';
  static const String jobSubmitted = 'submitted';
  static const String jobApproved = 'approved';
  static const String jobRejected = 'rejected';

  // Roles
  static const String roleCompanyManager = 'companyManager';
  static const String roleProjectManager = 'projectManager';
  static const String roleTeamLeader = 'teamLeader';
  static const String roleSuperAdmin = 'superAdmin';

  // Approval statuses
  static const String statusPending = 'pending';
  static const String statusApproved = 'approved';
  static const String statusRejected = 'rejected';

  // Project statuses
  static const String projectActive = 'ACTIVE';
  static const String projectCompleted = 'COMPLETED';
  static const String projectArchived = 'ARCHIVED';

  // Subscription statuses
  static const String subActive = 'active';
  static const String subSuspended = 'suspended';
  static const String subClosed = 'closed';
}
