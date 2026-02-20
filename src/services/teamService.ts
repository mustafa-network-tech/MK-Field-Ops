import { store } from '../data/store';
import type { User } from '../types';
import type { Team } from '../types';

/** ACTIVE = approved role in the system */
const ACTIVE_ROLE_STATUS = 'approved';

export type AddTeamResult = { ok: true; team: Team } | { ok: false; error: string; statusCode: number };
export type UpdateTeamResult = { ok: true; team: Team } | { ok: false; error: string; statusCode: number };

/**
 * Users eligible to be selected as Team Leader in the dropdown:
 * role === teamLeader, same company, status ACTIVE (roleApprovalStatus === approved).
 */
export function getEligibleTeamLeaders(companyId: string): User[] {
  return store.getUsers(companyId).filter(
    (u) =>
      u.role === 'teamLeader' &&
      u.companyId === companyId &&
      u.roleApprovalStatus === ACTIVE_ROLE_STATUS
  );
}

/**
 * Backend validation: leaderId must be an eligible team leader.
 * Returns 403 if leader is not a valid team leader.
 * Business rule (applies to all team create/update): single-team leadership —
 * one user can be leader of only one team (singleTeamLeadership = true).
 */
function validateLeader(
  companyId: string,
  leaderId: string | undefined,
  excludeTeamId?: string,
  singleTeamLeadership: boolean = true
): { ok: true } | { ok: false; error: string; statusCode: number } {
  if (!leaderId) return { ok: true };

  const user = store.getUsers(companyId).find((u) => u.id === leaderId);
  if (!user) {
    return { ok: false, error: 'teams.validation.leaderNotFound', statusCode: 403 };
  }
  if (user.role !== 'teamLeader') {
    return { ok: false, error: 'teams.validation.leaderMustBeTeamLeader', statusCode: 403 };
  }
  if (user.companyId !== companyId) {
    return { ok: false, error: 'teams.validation.leaderWrongCompany', statusCode: 403 };
  }
  if (user.roleApprovalStatus !== ACTIVE_ROLE_STATUS) {
    return { ok: false, error: 'teams.validation.leaderNotActive', statusCode: 403 };
  }

  if (singleTeamLeadership) {
    const teams = store.getTeams(companyId);
    const otherWithSameLeader = teams.find(
      (t) => t.leaderId === leaderId && t.id !== excludeTeamId
    );
    if (otherWithSameLeader) {
      return { ok: false, error: 'teams.validation.leaderAlreadyAssigned', statusCode: 403 };
    }
  }

  return { ok: true };
}

/**
 * Validates leader then creates team. Use instead of store.addTeam to enforce 403 on invalid leader.
 */
export function addTeam(
  currentUser: User | undefined,
  params: Omit<Team, 'id' | 'createdAt'>
): AddTeamResult {
  if (!currentUser) {
    return { ok: false, error: 'teams.validation.unauthorized', statusCode: 403 };
  }
  const companyId = params.companyId;
  const leaderCheck = validateLeader(companyId, params.leaderId, undefined, true);
  if (!leaderCheck.ok) return leaderCheck;

  const team = store.addTeam(params);
  return { ok: true, team };
}

/**
 * Validates leader then updates team. Use instead of store.updateTeam to enforce 403 on invalid leader.
 */
export function updateTeam(
  currentUser: User | undefined,
  teamId: string,
  patch: Partial<Team>
): UpdateTeamResult {
  if (!currentUser) {
    return { ok: false, error: 'teams.validation.unauthorized', statusCode: 403 };
  }
  const existing = store.getTeam(teamId);
  if (!existing || existing.companyId !== currentUser.companyId) {
    return { ok: false, error: 'teams.validation.teamNotFound', statusCode: 404 };
  }

  const leaderId = patch.leaderId !== undefined ? patch.leaderId : existing.leaderId;
  const leaderCheck = validateLeader(
    existing.companyId,
    leaderId ?? undefined,
    teamId,
    true
  );
  if (!leaderCheck.ok) return leaderCheck;

  const updated = store.updateTeam(teamId, patch);
  return updated ? { ok: true, team: updated } : { ok: false, error: 'teams.validation.updateFailed', statusCode: 500 };
}
