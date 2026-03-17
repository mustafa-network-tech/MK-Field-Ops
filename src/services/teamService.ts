import { store } from '../data/store';
import { logEvent, actorFromUser } from './auditLogService';
import { addActivityNotification } from './activityNotificationService';
import { canPlanAddTeam } from './planGating';
import { getEffectivePlan } from './subscriptionService';
import type { User } from '../types';
import type { Team } from '../types';

/** ACTIVE = approved role in the system */
const ACTIVE_ROLE_STATUS = 'approved';

export type AddTeamResult = { ok: true; team: Team } | { ok: false; error: string; statusCode: number };
export type UpdateTeamResult = { ok: true; team: Team } | { ok: false; error: string; statusCode: number };

/**
 * Users eligible to be selected as Team Leader in the dropdown:
 * Team Leader or Project Manager (Company Manager cannot be team leader). Same company, ACTIVE.
 */
export function getEligibleTeamLeaders(companyId: string): User[] {
  return store.getUsers(companyId).filter(
    (u) =>
      u.companyId === companyId &&
      u.roleApprovalStatus === ACTIVE_ROLE_STATUS &&
      (u.role === 'teamLeader' || u.role === 'projectManager')
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
  if (user.role !== 'teamLeader' && user.role !== 'projectManager') {
    return { ok: false, error: 'teams.validation.leaderMustBeTeamLeaderOrPM', statusCode: 403 };
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
 * Rule: team leader is required when creating a team; if there are no team leaders in the system, team cannot be created.
 * Rule: Starter plan can have at most 2 teams.
 */
export function addTeam(
  currentUser: User | undefined,
  params: Omit<Team, 'id' | 'createdAt'>
): AddTeamResult {
  if (!currentUser) {
    return { ok: false, error: 'teams.validation.unauthorized', statusCode: 403 };
  }
  const companyId = params.companyId;

  if (!params.leaderId || params.leaderId.trim() === '') {
    return { ok: false, error: 'teams.validation.leaderRequired', statusCode: 400 };
  }

  const codeTrimmed = (params.code ?? '').trim();
  if (codeTrimmed.length !== 3) {
    return { ok: false, error: 'teams.validation.codeMustBeThree', statusCode: 400 };
  }
  const existingTeams = store.getTeams(companyId);
  const codeExists = existingTeams.some(
    (t) => t.code.trim().toLowerCase() === codeTrimmed.toLowerCase()
  );
  if (codeExists) {
    return { ok: false, error: 'teams.validation.codeAlreadyExists', statusCode: 400 };
  }

  const company = store.getCompany(companyId, companyId);
  if (!canPlanAddTeam(getEffectivePlan(company) ?? null, existingTeams.length)) {
    return { ok: false, error: 'teams.validation.planTeamLimitReached', statusCode: 403 };
  }

  const leaderCheck = validateLeader(companyId, params.leaderId, undefined, true);
  if (!leaderCheck.ok) return leaderCheck;

  const team = store.addTeam(params);
  void import('./supabaseSyncService').then(({ upsertTeam }) => upsertTeam(team).catch(() => {}));
  const actor = actorFromUser(currentUser);
  if (actor) {
    logEvent(actor, {
      action: 'TEAM_CREATED',
      entity_type: 'team',
      entity_id: team.id,
      team_code: team.code,
      company_id: params.companyId,
      meta: { code: team.code, percentage: team.percentage },
    });
  }
  if (currentUser.role === 'projectManager') {
    addActivityNotification({
      companyId: params.companyId,
      type: 'pm_team_created',
      titleKey: 'notifications.pmTeamCreated',
      meta: { actorName: currentUser.fullName ?? '–', teamCode: team.code },
    });
  }
  void import('./supabaseNotificationService').then(({ pushNotificationToSupabase }) =>
    pushNotificationToSupabase(params.companyId, 'pm_team_created', 'notifications.pmTeamCreated', {
      actorName: currentUser.fullName ?? '–',
      teamCode: team.code,
    }).catch(() => {})
  );
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

  if (patch.code !== undefined) {
    const codeTrimmed = patch.code.trim();
    if (codeTrimmed.length !== 3) {
      return { ok: false, error: 'teams.validation.codeMustBeThree', statusCode: 400 };
    }
    const existingTeams = store.getTeams(existing.companyId);
    const codeExists = existingTeams.some(
      (t) => t.id !== teamId && t.code.trim().toLowerCase() === codeTrimmed.toLowerCase()
    );
    if (codeExists) {
      return { ok: false, error: 'teams.validation.codeAlreadyExists', statusCode: 400 };
    }
  }

  const updated = store.updateTeam(teamId, patch);
  if (updated) {
    void import('./supabaseSyncService').then(({ upsertTeam }) => upsertTeam(updated).catch(() => {}));
    const actor = actorFromUser(currentUser);
    if (actor) {
      logEvent(actor, {
        action: 'TEAM_UPDATED',
        entity_type: 'team',
        entity_id: teamId,
        team_code: updated.code,
        company_id: existing.companyId,
        meta: { code: updated.code, patch: Object.keys(patch) },
      });
    }
    return { ok: true, team: updated };
  }
  return { ok: false, error: 'teams.validation.updateFailed', statusCode: 500 };
}
