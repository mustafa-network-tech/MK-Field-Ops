import { store } from '../data/store';
import type { User } from '../types';
import type { Team } from '../types';

/** Apply companyId first (tenant isolation), then role scope. */

/**
 * Team IDs the user is allowed to access (for job/team scope).
 * - Team Leader: only teams where team.leaderId === user.id
 * - Project Manager / Company Manager: all teams in company
 */
function activeTeams(companyId: string) {
  return store.getTeams(companyId).filter((t) => !t.wipedAt);
}

export function getTeamIdsForUser(companyId: string, user: User | undefined): string[] {
  if (!companyId || !user) return [];
  const allTeams = activeTeams(companyId);
  if (user.role === 'teamLeader') {
    return allTeams.filter((t) => t.leaderId === user.id).map((t) => t.id);
  }
  return allTeams.map((t) => t.id);
}

/**
 * Teams the current user is allowed to use for job entry / job lists.
 * - Team Leader: only teams where team.leaderId === user.id
 * - Company Manager / Project Manager: all approved teams in company
 */
export function getTeamsForJobEntry(companyId: string, user: User | undefined) {
  if (!companyId || !user) return [];
  const allTeams = store.getTeams(companyId).filter((t) => !t.wipedAt && t.approvalStatus === 'approved');
  if (user.role === 'teamLeader') {
    return allTeams.filter((t) => t.leaderId === user.id);
  }
  return allTeams;
}

/**
 * Teams the user is allowed to see (e.g. Management list).
 * - Team Leader: only teams they lead
 * - CM/PM: all company teams
 */
export function getTeamsForUser(companyId: string, user: User | undefined): Team[] {
  if (!companyId || !user) return [];
  const all = activeTeams(companyId);
  if (user.role === 'teamLeader') {
    return all.filter((t) => t.leaderId === user.id);
  }
  return all;
}

/**
 * Backend: get team only if in user scope. Company first, then role scope.
 * Returns 404 if not found, 403 if out of scope.
 */
export function getTeamForUser(
  teamId: string,
  user: User | undefined
): { ok: true; team: Team } | { ok: false; statusCode: 403 | 404 } {
  if (!user || !teamId) return { ok: false, statusCode: 404 };
  const team = store.getTeam(teamId);
  if (!team) return { ok: false, statusCode: 404 };
  if (team.wipedAt) return { ok: false, statusCode: 404 };
  if (team.companyId !== user.companyId) return { ok: false, statusCode: 403 };
  if (user.role === 'teamLeader' && team.leaderId !== user.id) return { ok: false, statusCode: 403 };
  return { ok: true, team };
}

/**
 * Team IDs the team leader is allowed to use (for filtering jobs).
 * Returns empty array if user is not a team leader.
 */
export function getTeamIdsForTeamLeader(companyId: string, user: User | undefined): string[] {
  if (!companyId || !user || user.role !== 'teamLeader') return [];
  return getTeamIdsForUser(companyId, user);
}

/**
 * Team percentage (share) for the current user. Used to show TL their share and to display prices in team share.
 * - Team Leader: first team they lead (single team) percentage, or undefined if none.
 * - CM/PM: undefined (they see full prices).
 */
export function getTeamPercentageForUser(companyId: string, user: User | undefined): number | undefined {
  if (!companyId || !user || user.role !== 'teamLeader') return undefined;
  const teams = getTeamsForUser(companyId, user);
  return teams.length > 0 ? teams[0].percentage : undefined;
}

/**
 * Backend-style validation: whether the user is allowed to use this team for job create/update.
 * - Team Leader: team.leaderId must equal user.id
 * - Company Manager / Project Manager: team must exist and belong to same company
 */
export function canUserUseTeamForJob(user: User | undefined, teamId: string, companyId: string): boolean {
  if (!user || !teamId || !companyId) return false;
  const team = store.getTeam(teamId);
  if (!team || team.companyId !== companyId) return false;
  if (user.role === 'teamLeader') {
    return team.leaderId === user.id;
  }
  return true;
}
