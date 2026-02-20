import type {
  Company,
  User,
  Team,
  Vehicle,
  Material,
  Equipment,
  WorkItem,
  JobRecord,
  Role,
  ApprovalStatus,
  JobStatus,
} from '../types';

const STORAGE_KEYS = {
  companies: 'tf_companies',
  users: 'tf_users',
  teams: 'tf_teams',
  vehicles: 'tf_vehicles',
  materials: 'tf_materials',
  equipment: 'tf_equipment',
  workItems: 'tf_work_items',
  jobs: 'tf_jobs',
  currentUserId: 'tf_current_user_id',
} as const;

function load<T>(key: string, defaultVal: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const store = {
  getCompanies(): Company[] {
    return load(STORAGE_KEYS.companies, []);
  },
  addCompany(name: string): Company {
    const companies = this.getCompanies();
    const company: Company = { id: id(), name, createdAt: new Date().toISOString() };
    companies.push(company);
    save(STORAGE_KEYS.companies, companies);
    return company;
  },
  getCompany(id: string): Company | undefined {
    return this.getCompanies().find((c) => c.id === id);
  },

  getUsers(companyId?: string): User[] {
    const users = load<User[]>(STORAGE_KEYS.users, []);
    return companyId ? users.filter((u) => u.companyId === companyId) : users;
  },
  addUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const users = this.getUsers();
    const newUser: User = { ...user, id: id(), createdAt: new Date().toISOString() };
    users.push(newUser);
    save(STORAGE_KEYS.users, users);
    return newUser;
  },
  updateUser(userId: string, patch: Partial<User>): User | undefined {
    const users = this.getUsers();
    const i = users.findIndex((u) => u.id === userId);
    if (i === -1) return undefined;
    users[i] = { ...users[i], ...patch };
    save(STORAGE_KEYS.users, users);
    return users[i];
  },
  getUserByEmail(email: string, companyId?: string): User | undefined {
    const list = companyId ? this.getUsers(companyId) : this.getUsers();
    return list.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  getCurrentUserId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.currentUserId);
  },
  setCurrentUserId(userId: string | null): void {
    if (userId) localStorage.setItem(STORAGE_KEYS.currentUserId, userId);
    else localStorage.removeItem(STORAGE_KEYS.currentUserId);
  },
  getCurrentUser(): User | undefined {
    const uid = this.getCurrentUserId();
    if (!uid) return undefined;
    return this.getUsers().find((u) => u.id === uid);
  },

  getTeams(companyId: string): Team[] {
    const raw = load<Team[]>(STORAGE_KEYS.teams, []).filter((t) => t.companyId === companyId);
    return raw.map((t) => ({ ...t, memberIds: t.memberIds ?? [], membersManual: t.membersManual ?? [] }));
  },
  getTeam(teamId: string): Team | undefined {
    const teams = load<Team[]>(STORAGE_KEYS.teams, []);
    const t = teams.find((x) => x.id === teamId);
    return t ? { ...t, memberIds: t.memberIds ?? [], membersManual: t.membersManual ?? [] } : undefined;
  },
  addTeam(team: Omit<Team, 'id' | 'createdAt'>): Team {
    const teams = load<Team[]>(STORAGE_KEYS.teams, []);
    const newTeam: Team = {
      ...team,
      memberIds: team.memberIds ?? [],
      membersManual: team.membersManual ?? [],
      id: id(),
      createdAt: new Date().toISOString(),
    };
    teams.push(newTeam);
    save(STORAGE_KEYS.teams, teams);
    return newTeam;
  },
  updateTeam(teamId: string, patch: Partial<Team>): Team | undefined {
    const teams = load<Team[]>(STORAGE_KEYS.teams, []);
    const i = teams.findIndex((t) => t.id === teamId);
    if (i === -1) return undefined;
    teams[i] = {
      ...teams[i],
      ...patch,
      memberIds: patch.memberIds ?? teams[i].memberIds ?? [],
      membersManual: patch.membersManual ?? teams[i].membersManual ?? [],
    };
    save(STORAGE_KEYS.teams, teams);
    return teams[i];
  },

  getVehicles(companyId: string): Vehicle[] {
    return load<Vehicle[]>(STORAGE_KEYS.vehicles, []).filter((v) => v.companyId === companyId);
  },
  addVehicle(v: Omit<Vehicle, 'id'>): Vehicle {
    const list = load<Vehicle[]>(STORAGE_KEYS.vehicles, []);
    const newV: Vehicle = { ...v, id: id() };
    list.push(newV);
    save(STORAGE_KEYS.vehicles, list);
    return newV;
  },
  updateVehicle(id: string, patch: Partial<Vehicle>): Vehicle | undefined {
    const list = load<Vehicle[]>(STORAGE_KEYS.vehicles, []);
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    list[i] = { ...list[i], ...patch };
    save(STORAGE_KEYS.vehicles, list);
    return list[i];
  },
  deleteVehicle(id: string): boolean {
    const list = load<Vehicle[]>(STORAGE_KEYS.vehicles, []).filter((x) => x.id !== id);
    save(STORAGE_KEYS.vehicles, list);
    return true;
  },
  getVehicle(id: string): Vehicle | undefined {
    return load<Vehicle[]>(STORAGE_KEYS.vehicles, []).find((v) => v.id === id);
  },

  getMaterials(companyId: string): Material[] {
    return load<Material[]>(STORAGE_KEYS.materials, []).filter((m) => m.companyId === companyId);
  },
  addMaterial(m: Omit<Material, 'id'>): Material {
    const list = load<Material[]>(STORAGE_KEYS.materials, []);
    const newM: Material = { ...m, id: id() };
    list.push(newM);
    save(STORAGE_KEYS.materials, list);
    return newM;
  },
  updateMaterial(id: string, patch: Partial<Material>): Material | undefined {
    const list = load<Material[]>(STORAGE_KEYS.materials, []);
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    list[i] = { ...list[i], ...patch };
    save(STORAGE_KEYS.materials, list);
    return list[i];
  },
  deleteMaterial(id: string): boolean {
    const list = load<Material[]>(STORAGE_KEYS.materials, []).filter((x) => x.id !== id);
    save(STORAGE_KEYS.materials, list);
    return true;
  },

  getEquipment(companyId: string): Equipment[] {
    return load<Equipment[]>(STORAGE_KEYS.equipment, []).filter((e) => e.companyId === companyId);
  },
  addEquipment(e: Omit<Equipment, 'id'>): Equipment {
    const list = load<Equipment[]>(STORAGE_KEYS.equipment, []);
    const newE: Equipment = { ...e, id: id() };
    list.push(newE);
    save(STORAGE_KEYS.equipment, list);
    return newE;
  },
  updateEquipment(id: string, patch: Partial<Equipment>): Equipment | undefined {
    const list = load<Equipment[]>(STORAGE_KEYS.equipment, []);
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    list[i] = { ...list[i], ...patch };
    save(STORAGE_KEYS.equipment, list);
    return list[i];
  },
  deleteEquipment(id: string): boolean {
    const list = load<Equipment[]>(STORAGE_KEYS.equipment, []).filter((x) => x.id !== id);
    save(STORAGE_KEYS.equipment, list);
    return true;
  },

  getWorkItems(companyId: string): WorkItem[] {
    return load<WorkItem[]>(STORAGE_KEYS.workItems, []).filter((w) => w.companyId === companyId);
  },
  addWorkItem(w: Omit<WorkItem, 'id'>): WorkItem {
    const list = load<WorkItem[]>(STORAGE_KEYS.workItems, []);
    const newW: WorkItem = { ...w, id: id() };
    list.push(newW);
    save(STORAGE_KEYS.workItems, list);
    return newW;
  },
  updateWorkItem(id: string, patch: Partial<WorkItem>): WorkItem | undefined {
    const list = load<WorkItem[]>(STORAGE_KEYS.workItems, []);
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    list[i] = { ...list[i], ...patch };
    save(STORAGE_KEYS.workItems, list);
    return list[i];
  },
  deleteWorkItem(id: string): boolean {
    const list = load<WorkItem[]>(STORAGE_KEYS.workItems, []).filter((x) => x.id !== id);
    save(STORAGE_KEYS.workItems, list);
    return true;
  },

  getJobs(companyId: string): JobRecord[] {
    return load<JobRecord[]>(STORAGE_KEYS.jobs, []).filter((j) => j.companyId === companyId);
  },
  addJob(job: Omit<JobRecord, 'id' | 'createdAt' | 'updatedAt'>): JobRecord {
    const jobs = load<JobRecord[]>(STORAGE_KEYS.jobs, []);
    const now = new Date().toISOString();
    const newJob: JobRecord = { ...job, id: id(), createdAt: now, updatedAt: now };
    jobs.push(newJob);
    save(STORAGE_KEYS.jobs, jobs);
    return newJob;
  },
  updateJob(jobId: string, patch: Partial<JobRecord>): JobRecord | undefined {
    const jobs = load<JobRecord[]>(STORAGE_KEYS.jobs, []);
    const i = jobs.findIndex((j) => j.id === jobId);
    if (i === -1) return undefined;
    jobs[i] = { ...jobs[i], ...patch, updatedAt: new Date().toISOString() };
    save(STORAGE_KEYS.jobs, jobs);
    return jobs[i];
  },
};

export type { Role, ApprovalStatus, JobStatus };
