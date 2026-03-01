import type { Project } from '../types';

/** Display key for a project: year-externalId (e.g. 2026-11112023). */
export function getProjectDisplayKey(project: Project): string {
  return `${project.projectYear}-${project.externalProjectId}`;
}
