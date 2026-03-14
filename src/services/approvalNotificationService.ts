import { store } from '../data/store';
import { getJobsForUser } from './jobScopeService';
import type { User } from '../types';

/**
 * Pending approvals count for the current user (for nav highlight and top-right notification).
 * - Company Manager: job approvals (submitted) + user/role join approvals (pending).
 * - Project Manager: job approvals only (user approvals are company-management only).
 * - Others: 0 (no approval authority → no notification).
 */
export function getPendingApprovalsCountForUser(
  companyId: string,
  user: User | undefined
): number {
  if (!companyId || !user) return 0;
  const role = user.role;
  if (role !== 'companyManager' && role !== 'projectManager') return 0;

  const jobs = getJobsForUser(companyId, user);
  const jobPending = jobs.filter((j) => j.status === 'submitted').length;

  if (role === 'projectManager') return jobPending;

  const users = store.getUsers(companyId);
  const userPending = users.filter((u) => u.roleApprovalStatus === 'pending').length;
  return jobPending + userPending;
}
