import type {
  Company,
  User,
  Team,
  Vehicle,
  Campaign,
  Project,
  Material,
  MaterialStockItem,
  MaterialMainType,
  TeamMaterialAllocation,
  MaterialAuditLogEntry,
  MaterialAuditActionType,
  Equipment,
  WorkItem,
  JobRecord,
  Role,
  ApprovalStatus,
  JobStatus,
  DeliveryNote,
  DeliveryNoteItem,
  PayrollPeriodSettings,
} from '../types';

const STORAGE_KEYS = {
  companies: 'tf_companies',
  users: 'tf_users',
  teams: 'tf_teams',
  vehicles: 'tf_vehicles',
  materials: 'tf_materials',
  materialStock: 'tf_material_stock',
  teamMaterialAllocations: 'tf_team_material_allocations',
  materialAuditLog: 'tf_material_audit_log',
  deliveryNotes: 'tf_delivery_notes',
  deliveryNoteItems: 'tf_delivery_note_items',
  equipment: 'tf_equipment',
  workItems: 'tf_work_items',
  campaigns: 'tf_campaigns',
  projects: 'tf_projects',
  jobs: 'tf_jobs',
  currentUserId: 'tf_current_user_id',
  payrollPeriodSettings: 'tf_payroll_period_settings',
} as const;

/** Normalize external project ID: trim and collapse multiple spaces. */
function normalizeExternalProjectId(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Migrate old project shape (projectId) to new (campaignId, projectYear, externalProjectId). */
function migrateProjects(list: unknown[]): Project[] {
  const campaigns = load<Campaign[]>(STORAGE_KEYS.campaigns, []);
  const result: Project[] = [];
  for (const p of list as Array<Record<string, unknown>>) {
    if (p.externalProjectId != null && p.projectYear != null && p.campaignId != null) {
      const existing = p as unknown as Project;
      const migrated = {
        ...existing,
        receivedDate: existing.receivedDate ?? (existing.createdAt ? existing.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        completedAt: existing.completedAt ?? undefined,
        completedBy: existing.completedBy ?? undefined,
      };
      result.push(migrated);
      continue;
    }
    const oldId = p.projectId as string | undefined;
    if (oldId == null || typeof oldId !== 'string') continue;
    const companyId = p.companyId as string;
    let campaignId = p.campaignId as string | undefined;
    if (!campaignId) {
      let defaultCamp = campaigns.find((c) => c.companyId === companyId && c.name === 'Default');
      if (!defaultCamp) {
        defaultCamp = { id: id(), companyId, name: 'Default', createdAt: new Date().toISOString() };
        campaigns.push(defaultCamp);
        save(STORAGE_KEYS.campaigns, campaigns);
      }
      campaignId = defaultCamp.id;
    }
    const createdAt = p.createdAt as string;
    result.push({
      ...p,
      id: p.id as string,
      companyId,
      campaignId,
      projectYear: typeof p.projectYear === 'number' ? p.projectYear : new Date().getFullYear(),
      externalProjectId: normalizeExternalProjectId(oldId),
      receivedDate: (p.receivedDate as string) ?? (createdAt ? createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      name: p.name ?? undefined,
      description: p.description ?? undefined,
      status: (p.status as Project['status']) ?? 'ACTIVE',
      completedAt: (p.completedAt as string | undefined) ?? undefined,
      completedBy: (p.completedBy as string | undefined) ?? undefined,
      createdBy: (p.createdBy as string) ?? '',
      createdAt,
      updatedAt: p.updatedAt as string,
    } as Project);
  }
  return result;
}

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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const store = {
  getCompanies(): Company[] {
    const raw = load<Company[]>(STORAGE_KEYS.companies, []);
    return raw.map((c) => ({ ...c, logo_url: c.logo_url ?? null, language_code: c.language_code ?? 'en' }));
  },
  addCompany(name: string): Company {
    const companies = this.getCompanies();
    const company: Company = { id: id(), name, language_code: 'en', createdAt: new Date().toISOString() };
    companies.push(company);
    save(STORAGE_KEYS.companies, companies);
    return company;
  },
  /** Update company. Pass onlyForCompanyId to enforce tenant isolation (update only if companyId === onlyForCompanyId). */
  updateCompany(companyId: string, patch: Partial<Pick<Company, 'name' | 'logo_url' | 'language_code' | 'plan' | 'plan_start_date' | 'plan_end_date' | 'pending_plan' | 'pending_plan_billing_cycle' | 'subscription_status' | 'closure_requested_at' | 'purge_after' | 'closed_by_user_id'>>, onlyForCompanyId?: string): Company | undefined {
    if (onlyForCompanyId != null && companyId !== onlyForCompanyId) return undefined;
    const companies = this.getCompanies();
    const i = companies.findIndex((c) => c.id === companyId);
    if (i === -1) return undefined;
    companies[i] = { ...companies[i], ...patch };
    save(STORAGE_KEYS.companies, companies);
    return companies[i];
  },
  /** Returns company only if it matches id. Pass onlyForCompanyId to enforce tenant isolation (return undefined if id !== onlyForCompanyId). */
  getCompany(id: string, onlyForCompanyId?: string): Company | undefined {
    if (onlyForCompanyId != null && id !== onlyForCompanyId) return undefined;
    const c = this.getCompanies().find((x) => x.id === id);
    return c ? { ...c, language_code: (c.language_code ?? 'en') as Company['language_code'] } : undefined;
  },

  /** Ensure a company exists in store (e.g. from Supabase). Adds if missing. */
  ensureCompany(id: string, name: string): void {
    const raw = load<Company[]>(STORAGE_KEYS.companies, []);
    if (raw.some((c) => c.id === id)) return;
    raw.push({ id, name, createdAt: new Date().toISOString(), language_code: 'en' });
    save(STORAGE_KEYS.companies, raw);
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
  /** Şirketten çıkarıldı: yerel listeden kaldır (Supabase’de profil ayrı güncellenir). */
  detachUserFromCompany(userId: string, companyId: string): void {
    const users = this.getUsers();
    const next = users.filter((u) => !(u.id === userId && u.companyId === companyId));
    save(STORAGE_KEYS.users, next);
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

  /** Set current user from Supabase profile. Upserts into users list and sets current user. Isolates store to this tenant. */
  setUserFromProfile(profile: { id: string; company_id: string; role: string | null; full_name: string | null; role_approval_status: string; email?: string | null; can_see_prices?: boolean | null }, email: string): User {
    const u = this.mergeUserFromProfile(profile, email);
    this.setCurrentUserId(profile.id);
    if (profile.company_id) this.isolateTenantData(profile.company_id);
    return u;
  },

  /** Merge Supabase profile into users list (no current user change). For CM/PM to see pending users. company_id can be null for pending join. Preserves canSeePrices when merging existing user. */
  mergeUserFromProfile(profile: { id: string; company_id: string | null; role: string | null; full_name: string | null; role_approval_status: string; email?: string | null; can_see_prices?: boolean | null }, email: string): User {
    const users = this.getUsers();
    const u: User = {
      id: profile.id,
      companyId: profile.company_id ?? '',
      email: profile.email ?? email,
      passwordHash: '',
      fullName: profile.full_name ?? email,
      role: (profile.role as User['role']) ?? undefined,
      roleApprovalStatus: (profile.role_approval_status as User['roleApprovalStatus']) ?? 'pending',
      createdAt: new Date().toISOString(),
      canSeePrices: profile.can_see_prices ?? undefined,
    };
    const i = users.findIndex((x) => x.id === profile.id);
    if (i >= 0) {
      users[i] = { ...u, canSeePrices: u.canSeePrices ?? users[i].canSeePrices };
    } else {
      users.push(u);
    }
    save(STORAGE_KEYS.users, users);
    return users.find((x) => x.id === profile.id)!;
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

  /** Yeni nesil malzeme stok sistemi (Malzeme Stok sekmesi) */
  getMaterialStock(companyId: string): MaterialStockItem[] {
    return load<MaterialStockItem[]>(STORAGE_KEYS.materialStock, []).filter((m) => m.companyId === companyId);
  },
  addMaterialStock(item: Omit<MaterialStockItem, 'id' | 'createdAt'>): MaterialStockItem {
    const list = load<MaterialStockItem[]>(STORAGE_KEYS.materialStock, []);
    const newItem: MaterialStockItem = {
      ...item,
      id: id(),
      createdAt: new Date().toISOString(),
    };
    list.push(newItem);
    save(STORAGE_KEYS.materialStock, list);
    return newItem;
  },
  updateMaterialStock(idValue: string, patch: Partial<MaterialStockItem>): MaterialStockItem | undefined {
    const list = load<MaterialStockItem[]>(STORAGE_KEYS.materialStock, []);
    const i = list.findIndex((x) => x.id === idValue);
    if (i === -1) return undefined;
    list[i] = { ...list[i], ...patch };
    save(STORAGE_KEYS.materialStock, list);
    return list[i];
  },
  deleteMaterialStock(idValue: string): boolean {
    const list = load<MaterialStockItem[]>(STORAGE_KEYS.materialStock, []).filter((x) => x.id !== idValue);
    save(STORAGE_KEYS.materialStock, list);
    return true;
  },

  getDeliveryNotes(companyId: string): DeliveryNote[] {
    return load<DeliveryNote[]>(STORAGE_KEYS.deliveryNotes, []).filter((n) => n.companyId === companyId);
  },
  getDeliveryNote(id: string): DeliveryNote | undefined {
    return load<DeliveryNote[]>(STORAGE_KEYS.deliveryNotes, []).find((n) => n.id === id);
  },
  getDeliveryNoteItems(deliveryNoteId: string): DeliveryNoteItem[] {
    return load<DeliveryNoteItem[]>(STORAGE_KEYS.deliveryNoteItems, []).filter(
      (i) => i.deliveryNoteId === deliveryNoteId
    );
  },
  addDeliveryNote(note: Omit<DeliveryNote, 'id' | 'createdAt'>): DeliveryNote {
    const list = load<DeliveryNote[]>(STORAGE_KEYS.deliveryNotes, []);
    const newNote: DeliveryNote = { ...note, id: id(), createdAt: new Date().toISOString() };
    list.push(newNote);
    save(STORAGE_KEYS.deliveryNotes, list);
    return newNote;
  },
  addDeliveryNoteItem(item: Omit<DeliveryNoteItem, 'id' | 'createdAt'>): DeliveryNoteItem {
    const list = load<DeliveryNoteItem[]>(STORAGE_KEYS.deliveryNoteItems, []);
    const newItem: DeliveryNoteItem = { ...item, id: id(), createdAt: new Date().toISOString() };
    list.push(newItem);
    save(STORAGE_KEYS.deliveryNoteItems, list);
    return newItem;
  },
  /**
   * İrsaliye teslim al: kalem tanımlarına göre stok bulunur/oluşturulur, miktar eklenir.
   * Teslim alındıktan sonra ekleme/çıkarma/düzenleme yapılamaz. receivedBy ile teslim alan kullanıcı kaydedilir.
   */
  receiveDeliveryNote(
    companyId: string,
    payload: {
      supplier: string;
      receivedDate: string;
      irsaliyeNo: string;
      receivedBy?: string;
      items: Array<{
        /** Malzeme Adı (zorunlu) */
        name: string;
        /** Malzeme Cinsi (opsiyonel) */
        typeLabel?: string;
        /** Malzeme Ebatı (opsiyonel) */
        sizeLabel?: string;
        /** Malzeme ID (opsiyonel; stok kalemini bölmez) */
        materialDetailId?: string;
        quantity: number;
        /** Kullanıcının seçtiği birim (adet, metre, kilo, metreküp). */
        unit: 'adet' | 'metre' | 'kilo' | 'metreküp';
      }>;
    }
  ): { note: DeliveryNote; error?: string } {
    const now = new Date().toISOString();
    const note = this.addDeliveryNote({
      companyId,
      supplier: payload.supplier.trim(),
      receivedDate: payload.receivedDate,
      irsaliyeNo: payload.irsaliyeNo.trim(),
      receivedBy: payload.receivedBy ?? undefined,
      receivedAt: now,
    });
    const stock = load<MaterialStockItem[]>(STORAGE_KEYS.materialStock, []).filter((m) => m.companyId === companyId);
    let firstMaterialStockItemId: string | null = null;
    const normalize = (val: string | undefined | null): string =>
      (val ?? '').trim().toLowerCase();
    for (const line of payload.items) {
      if (line.quantity <= 0) continue;
      const name = (line.name ?? '').trim();
      if (!name) continue;
      const typeLabel = (line.typeLabel ?? '').trim();
      const sizeLabel = (line.sizeLabel ?? '').trim();
      const detailId = (line.materialDetailId ?? '').trim();
      const unitDisplay = line.unit;
      const isMeterUnit = unitDisplay === 'metre';
      const quantityUnit: 'm' | 'pcs' = isMeterUnit ? 'm' : 'pcs';
      const keyName = normalize(name);
      const keyType = normalize(typeLabel);
      const keySize = normalize(sizeLabel);
      let materialStockItemId: string;
      // ANA KURAL: Aynı stok kalemi Malzeme Adı + Cinsi + Ebat kombinasyonuna göre belirlenir.
      const existing = stock.find((m) => {
        if (m.companyId !== companyId) return false;
        const mName = normalize(m.name);
        const mType = normalize(m.materialTypeLabel ?? m.capacityLabel);
        const mSize = normalize(m.sizeOrCapacity);
        return mName === keyName && mType === keyType && mSize === keySize;
      });

      if (existing) {
        // Eğer bu stok kalemi için daha önce birim bilgisi set edilmemişse, ilk gördüğümüz birimi kaydedelim.
        if (!existing.unitDisplay) {
          this.updateMaterialStock(existing.id, { unitDisplay });
          const inMem = stock.find((m) => m.id === existing.id);
          if (inMem) inMem.unitDisplay = unitDisplay;
        }
        if (isMeterUnit) {
          const addM = line.quantity;
          const newTotal = (existing.lengthTotal ?? 0) + addM;
          const newRem = (existing.lengthRemaining ?? 0) + addM;
          this.updateMaterialStock(existing.id, {
            lengthTotal: newTotal,
            lengthRemaining: newRem,
          });
          const updated = stock.find((m) => m.id === existing.id);
          if (updated) {
            updated.lengthTotal = newTotal;
            updated.lengthRemaining = newRem;
          }
        } else {
          const addQty = line.quantity;
          const newQty = (existing.stockQty ?? 0) + addQty;
          this.updateMaterialStock(existing.id, {
            stockQty: newQty,
          });
          const updated = stock.find((m) => m.id === existing.id);
          if (updated) updated.stockQty = newQty;
        }
        materialStockItemId = existing.id;
      } else {
        const newItem: MaterialStockItem = {
          id: id(),
          companyId,
          // Yeni dinamik sistem: kategori kullanıcıya gösterilmiyor; metre bazlı ise içerde 'boru', diğerleri 'custom' olarak tutulur.
          mainType: isMeterUnit ? ('boru' as MaterialMainType) : ('custom' as MaterialMainType),
          name,
          sizeOrCapacity: sizeLabel || undefined,
          capacityLabel: typeLabel || undefined,
          materialTypeLabel: typeLabel || undefined,
          materialDetailIds: detailId ? [detailId] : [],
          unitDisplay,
          stockQty: !isMeterUnit ? line.quantity : undefined,
          lengthTotal: isMeterUnit ? line.quantity : undefined,
          lengthRemaining: isMeterUnit ? line.quantity : undefined,
          createdAt: now,
        };
        const list = load<MaterialStockItem[]>(STORAGE_KEYS.materialStock, []);
        list.push(newItem);
        save(STORAGE_KEYS.materialStock, list);
        stock.push(newItem);
        materialStockItemId = newItem.id;
      }

      if (!firstMaterialStockItemId) {
        firstMaterialStockItemId = materialStockItemId;
      }

      // Malzeme ID bilgisi stok kalemini bölmez; aynı stok kalemi altında detay listesi olarak tutulur.
      if (detailId) {
        const sItem = stock.find((m) => m.id === materialStockItemId);
        if (sItem) {
          const existingIds = sItem.materialDetailIds ?? [];
          if (!existingIds.includes(detailId)) {
            const nextIds = [...existingIds, detailId];
            sItem.materialDetailIds = nextIds;
            this.updateMaterialStock(materialStockItemId, { materialDetailIds: nextIds });
          }
        }
      }
      this.addDeliveryNoteItem({
        deliveryNoteId: note.id,
        materialStockItemId,
        quantity: line.quantity,
        quantityUnit,
        unitDisplay,
        materialDetailId: detailId || undefined,
      });
    }
    // İrsaliye kabul hareketini denetim kaydına yaz (malzeme alanları boş gösterilecek).
    this.addMaterialAuditLog({
      companyId,
      actionType: 'DELIVERY_NOTE_RECEIVE',
      actorUserId: payload.receivedBy ?? '-',
      actorRole: '',
      materialStockItemId: firstMaterialStockItemId ?? 'delivery-note',
      fromTeamId: null,
      toTeamId: null,
      qtyCount: null,
      qtyMeters: null,
      spoolId: null,
      note: note.irsaliyeNo,
    });
    return { note };
  },

  /** Ekip zimmeti: ekibe dağıtılan malzemeler */
  getTeamMaterialAllocations(companyId: string, teamId?: string): TeamMaterialAllocation[] {
    const raw = load<TeamMaterialAllocation[]>(STORAGE_KEYS.teamMaterialAllocations, []);
    const byCompany = raw.filter((a) => a.companyId === companyId);
    return teamId ? byCompany.filter((a) => a.teamId === teamId) : byCompany;
  },
  addTeamMaterialAllocation(a: Omit<TeamMaterialAllocation, 'id' | 'createdAt'>): TeamMaterialAllocation {
    const list = load<TeamMaterialAllocation[]>(STORAGE_KEYS.teamMaterialAllocations, []);
    const newA: TeamMaterialAllocation = { ...a, id: id(), createdAt: new Date().toISOString() };
    list.push(newA);
    save(STORAGE_KEYS.teamMaterialAllocations, list);
    return newA;
  },
  updateTeamMaterialAllocation(idValue: string, patch: Partial<TeamMaterialAllocation>): TeamMaterialAllocation | undefined {
    const list = load<TeamMaterialAllocation[]>(STORAGE_KEYS.teamMaterialAllocations, []);
    const i = list.findIndex((x) => x.id === idValue);
    if (i === -1) return undefined;
    list[i] = { ...list[i], ...patch };
    save(STORAGE_KEYS.teamMaterialAllocations, list);
    return list[i];
  },
  deleteTeamMaterialAllocation(idValue: string): boolean {
    const list = load<TeamMaterialAllocation[]>(STORAGE_KEYS.teamMaterialAllocations, []).filter((x) => x.id !== idValue);
    save(STORAGE_KEYS.teamMaterialAllocations, list);
    return true;
  },

  /** Malzeme hareket denetim kaydı */
  getMaterialAuditLog(
    companyId: string,
    opts?: { teamId?: string; actionType?: MaterialAuditActionType; fromDate?: string; toDate?: string }
  ): MaterialAuditLogEntry[] {
    let list = load<MaterialAuditLogEntry[]>(STORAGE_KEYS.materialAuditLog, []).filter((e) => e.companyId === companyId);
    if (opts?.teamId) list = list.filter((e) => e.fromTeamId === opts.teamId || e.toTeamId === opts.teamId);
    if (opts?.actionType) list = list.filter((e) => e.actionType === opts.actionType);
    if (opts?.fromDate) list = list.filter((e) => e.createdAt >= opts.fromDate!);
    if (opts?.toDate) list = list.filter((e) => e.createdAt <= opts.toDate!);
    return list.sort((a, b) => (b.createdAt.localeCompare(a.createdAt)));
  },
  addMaterialAuditLog(entry: Omit<MaterialAuditLogEntry, 'id' | 'createdAt'>): MaterialAuditLogEntry {
    const list = load<MaterialAuditLogEntry[]>(STORAGE_KEYS.materialAuditLog, []);
    const newEntry: MaterialAuditLogEntry = {
      ...entry,
      id: id(),
      createdAt: new Date().toISOString(),
    };
    list.push(newEntry);
    save(STORAGE_KEYS.materialAuditLog, list);
    return newEntry;
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

  getCampaigns(companyId: string): Campaign[] {
    return load<Campaign[]>(STORAGE_KEYS.campaigns, []).filter((c) => c.companyId === companyId);
  },
  /** Returns campaign only if it belongs to the given company (ensures tenant isolation). */
  getCampaign(id: string, companyId?: string): Campaign | undefined {
    const list = load<Campaign[]>(STORAGE_KEYS.campaigns, []);
    const c = list.find((x) => x.id === id);
    if (!c) return undefined;
    if (companyId != null && c.companyId !== companyId) return undefined;
    return c;
  },
  addCampaign(campaign: Omit<Campaign, 'id' | 'createdAt'>): Campaign {
    const list = load<Campaign[]>(STORAGE_KEYS.campaigns, []);
    const newC: Campaign = { ...campaign, id: id(), createdAt: new Date().toISOString() };
    list.push(newC);
    save(STORAGE_KEYS.campaigns, list);
    return newC;
  },
  updateCampaign(id: string, patch: Partial<Pick<Campaign, 'name'>>, companyId?: string): Campaign | undefined {
    const list = load<Campaign[]>(STORAGE_KEYS.campaigns, []);
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    if (companyId != null && list[i].companyId !== companyId) return undefined;
    list[i] = { ...list[i], ...patch };
    save(STORAGE_KEYS.campaigns, list);
    return list[i];
  },

  getProjects(companyId: string, options?: { campaignId?: string; status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' }): Project[] {
    const raw = load<unknown[]>(STORAGE_KEYS.projects, []);
    const list = migrateProjects(raw);
    const needsSave =
      raw.length !== list.length ||
      list.some((p, i) => {
        const r = raw[i] as Record<string, unknown> & Project;
        return r.externalProjectId !== p.externalProjectId || (r.receivedDate === undefined && p.receivedDate != null);
      });
    if (needsSave) save(STORAGE_KEYS.projects, list);
    let out = list.filter((p) => p.companyId === companyId);
    if (options?.campaignId) out = out.filter((p) => p.campaignId === options.campaignId);
    if (options?.status) out = out.filter((p) => p.status === options.status);
    return out;
  },
  /** Returns project only if it belongs to the given company (ensures tenant isolation). */
  getProject(id: string, companyId?: string): Project | undefined {
    const raw = load<unknown[]>(STORAGE_KEYS.projects, []);
    const list = migrateProjects(raw);
    const p = list.find((x) => x.id === id);
    if (!p) return undefined;
    if (companyId != null && p.companyId !== companyId) return undefined;
    return p;
  },
  addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const raw = load<unknown[]>(STORAGE_KEYS.projects, []);
    const list = migrateProjects(raw);
    const year = project.projectYear;
    if (year == null || !Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error('PROJECT_YEAR_INVALID');
    }
    const external = normalizeExternalProjectId(project.externalProjectId);
    if (!external) throw new Error('PROJECT_EXTERNAL_ID_EMPTY');
    const keyExists = list.some(
      (p) =>
        p.companyId === project.companyId &&
        p.campaignId === project.campaignId &&
        p.projectYear === year &&
        p.externalProjectId === external
    );
    if (keyExists) throw new Error('PROJECT_KEY_EXISTS');
    const now = new Date().toISOString();
    const receivedDate = (project.receivedDate && /^\d{4}-\d{2}-\d{2}$/.test(project.receivedDate))
      ? project.receivedDate
      : now.slice(0, 10);
    const newP: Project = {
      ...project,
      externalProjectId: external,
      receivedDate,
      id: id(),
      createdAt: now,
      updatedAt: now,
    };
    list.push(newP);
    save(STORAGE_KEYS.projects, list);
    return newP;
  },
  /** For Starter plan: ensure one default campaign and one default project exist so job entry can run without project UI. Returns default project id or null. */
  ensureStarterDefaultProject(companyId: string, plan: string | null | undefined): string | null {
    if (plan !== 'starter') return null;
    const campaigns = this.getCampaigns(companyId);
    let defaultCamp = campaigns.find((c) => c.name === 'Default');
    if (!defaultCamp) {
      defaultCamp = this.addCampaign({ companyId, name: 'Default' });
    }
    const projects = this.getProjects(companyId, { campaignId: defaultCamp.id, status: 'ACTIVE' });
    if (projects.length > 0) return projects[0].id;
    const year = new Date().getFullYear();
    try {
      const proj = this.addProject({
        companyId,
        campaignId: defaultCamp.id,
        projectYear: year,
        externalProjectId: 'STARTER-DEFAULT',
        receivedDate: new Date().toISOString().slice(0, 10),
        name: 'Default',
        status: 'ACTIVE',
        createdBy: '',
      });
      return proj.id;
    } catch {
      return null;
    }
  },
  updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'campaignId' | 'projectYear' | 'externalProjectId' | 'receivedDate' | 'completedAt' | 'completedBy'>>): Project | undefined {
    const raw = load<unknown[]>(STORAGE_KEYS.projects, []);
    const list = migrateProjects(raw);
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return undefined;
    const updated = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
    if (patch.projectYear != null && (patch.projectYear < 2000 || patch.projectYear > 2100)) {
      throw new Error('PROJECT_YEAR_INVALID');
    }
    if (patch.externalProjectId !== undefined) {
      const external = normalizeExternalProjectId(patch.externalProjectId);
      if (!external) throw new Error('PROJECT_EXTERNAL_ID_EMPTY');
      updated.externalProjectId = external;
    }
    const duplicate = list.some(
      (p, idx) =>
        idx !== i &&
        p.companyId === updated.companyId &&
        p.campaignId === updated.campaignId &&
        p.projectYear === updated.projectYear &&
        p.externalProjectId === updated.externalProjectId
    );
    if (duplicate) throw new Error('PROJECT_KEY_EXISTS');
    list[i] = updated;
    save(STORAGE_KEYS.projects, list);
    return list[i];
  },
  /** Mark project as COMPLETED; sets completedAt and completedBy. Caller must enforce CM/PM only. */
  completeProject(projectId: string, completedBy: string): Project | undefined {
    const raw = load<unknown[]>(STORAGE_KEYS.projects, []);
    const list = migrateProjects(raw);
    const i = list.findIndex((x) => x.id === projectId);
    if (i === -1) return undefined;
    const now = new Date().toISOString();
    list[i] = { ...list[i], status: 'COMPLETED', completedAt: now, completedBy, updatedAt: now };
    save(STORAGE_KEYS.projects, list);
    return list[i];
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
    const now = new Date().toISOString();
    const updated = { ...jobs[i], ...patch, updatedAt: now };
    if (patch.status === 'approved' && !updated.approvedAt) updated.approvedAt = now;
    jobs[i] = updated;
    save(STORAGE_KEYS.jobs, jobs);
    return jobs[i];
  },
  deleteJob(jobId: string): boolean {
    const jobs = load<JobRecord[]>(STORAGE_KEYS.jobs, []);
    const next = jobs.filter((j) => j.id !== jobId);
    if (next.length === jobs.length) return false;
    save(STORAGE_KEYS.jobs, next);
    return true;
  },
  /** Zimmet onay geri alma: silinen veya değişen satırı eski haline getir. */
  replaceTeamMaterialAllocation(a: TeamMaterialAllocation): void {
    const list = load<TeamMaterialAllocation[]>(STORAGE_KEYS.teamMaterialAllocations, []);
    const i = list.findIndex((x) => x.id === a.id);
    if (i >= 0) list[i] = { ...a };
    else list.push({ ...a });
    save(STORAGE_KEYS.teamMaterialAllocations, list);
  },

  getPayrollPeriodSettings(companyId: string): PayrollPeriodSettings | undefined {
    const list = load<PayrollPeriodSettings[]>(STORAGE_KEYS.payrollPeriodSettings, []);
    return list.find((s) => s.companyId === companyId);
  },
  setPayrollPeriodSettings(
    companyId: string,
    payload: { startDayOfMonth: number; updatedBy: string }
  ): PayrollPeriodSettings {
    const list = load<PayrollPeriodSettings[]>(STORAGE_KEYS.payrollPeriodSettings, []);
    const now = new Date().toISOString();
    const existing = list.findIndex((s) => s.companyId === companyId);
    const settings: PayrollPeriodSettings = {
      companyId,
      startDayOfMonth: payload.startDayOfMonth,
      updatedBy: payload.updatedBy,
      updatedAt: now,
    };
    if (existing >= 0) {
      list[existing] = settings;
    } else {
      list.push(settings);
    }
    save(STORAGE_KEYS.payrollPeriodSettings, list);
    return settings;
  },

  /**
   * Replace this company's campaigns, vehicles, equipment, work items, teams, projects, jobs, material stock
   * with data fetched from Supabase (e.g. after login on another device or after push).
   */
  replaceCompanyDataFromSupabase(
    companyId: string,
    data: {
      campaigns: Campaign[];
      vehicles: Vehicle[];
      equipment: Equipment[];
      workItems: WorkItem[];
      teams: Team[];
      projects: Project[];
      jobs: JobRecord[];
      materialStock?: MaterialStockItem[];
      teamMaterialAllocations?: TeamMaterialAllocation[];
    }
  ): void {
    const campaigns = load<Campaign[]>(STORAGE_KEYS.campaigns, []).filter((c) => c.companyId !== companyId).concat(data.campaigns);
    save(STORAGE_KEYS.campaigns, campaigns);
    const vehicles = load<Vehicle[]>(STORAGE_KEYS.vehicles, []).filter((v) => v.companyId !== companyId).concat(data.vehicles);
    save(STORAGE_KEYS.vehicles, vehicles);
    const equipment = load<Equipment[]>(STORAGE_KEYS.equipment, []).filter((e) => e.companyId !== companyId).concat(data.equipment);
    save(STORAGE_KEYS.equipment, equipment);
    const workItems = load<WorkItem[]>(STORAGE_KEYS.workItems, []).filter((w) => w.companyId !== companyId).concat(data.workItems);
    save(STORAGE_KEYS.workItems, workItems);
    const teams = load<Team[]>(STORAGE_KEYS.teams, []).filter((t) => t.companyId !== companyId).concat(data.teams);
    save(STORAGE_KEYS.teams, teams);
    const projects = load<unknown[]>(STORAGE_KEYS.projects, []);
    const migrated = migrateProjects(projects);
    const otherProjects = migrated.filter((p) => p.companyId !== companyId);
    const allProjects = [...otherProjects, ...data.projects];
    save(STORAGE_KEYS.projects, allProjects);
    const jobs = load<JobRecord[]>(STORAGE_KEYS.jobs, []).filter((j) => j.companyId !== companyId).concat(data.jobs);
    save(STORAGE_KEYS.jobs, jobs);
    if (data.materialStock && data.materialStock.length >= 0) {
      const list = load<MaterialStockItem[]>(STORAGE_KEYS.materialStock, []).filter((m) => m.companyId !== companyId);
      save(STORAGE_KEYS.materialStock, list.concat(data.materialStock));
    }

    if (data.teamMaterialAllocations) {
      const list = load<TeamMaterialAllocation[]>(STORAGE_KEYS.teamMaterialAllocations, []).filter((a) => a.companyId !== companyId);
      const allocationsForCompany = data.teamMaterialAllocations.filter((a) => a.companyId === companyId);
      save(STORAGE_KEYS.teamMaterialAllocations, list.concat(allocationsForCompany));
    }
  },

  /**
   * Strict tenant isolation: keep only data for this company in storage.
   * Call after login/restore so the panel never shows another company's data (logo, names, jobs, etc.).
   */
  isolateTenantData(companyId: string): void {
    if (!companyId) return;
    const companies = load<Company[]>(STORAGE_KEYS.companies, []).filter((c) => c.id === companyId);
    save(STORAGE_KEYS.companies, companies);
    const users = load<User[]>(STORAGE_KEYS.users, []).filter((u) => u.companyId === companyId);
    save(STORAGE_KEYS.users, users);
    const teams = load<Team[]>(STORAGE_KEYS.teams, []).filter((t) => t.companyId === companyId);
    save(STORAGE_KEYS.teams, teams);
    const vehicles = load<Vehicle[]>(STORAGE_KEYS.vehicles, []).filter((v) => v.companyId === companyId);
    save(STORAGE_KEYS.vehicles, vehicles);
    const materials = load<Material[]>(STORAGE_KEYS.materials, []).filter((m) => m.companyId === companyId);
    save(STORAGE_KEYS.materials, materials);
    const materialStock = load<MaterialStockItem[]>(STORAGE_KEYS.materialStock, []).filter((m) => m.companyId === companyId);
    save(STORAGE_KEYS.materialStock, materialStock);
    const deliveryNotes = load<DeliveryNote[]>(STORAGE_KEYS.deliveryNotes, []).filter((n) => n.companyId === companyId);
    save(STORAGE_KEYS.deliveryNotes, deliveryNotes);
    const noteIds = new Set(deliveryNotes.map((n) => n.id));
    const deliveryNoteItems = load<DeliveryNoteItem[]>(STORAGE_KEYS.deliveryNoteItems, []).filter((i) => noteIds.has(i.deliveryNoteId));
    save(STORAGE_KEYS.deliveryNoteItems, deliveryNoteItems);
    const equipment = load<Equipment[]>(STORAGE_KEYS.equipment, []).filter((e) => e.companyId === companyId);
    save(STORAGE_KEYS.equipment, equipment);
    const workItems = load<WorkItem[]>(STORAGE_KEYS.workItems, []).filter((w) => w.companyId === companyId);
    save(STORAGE_KEYS.workItems, workItems);
    const campaigns = load<Campaign[]>(STORAGE_KEYS.campaigns, []).filter((c) => c.companyId === companyId);
    save(STORAGE_KEYS.campaigns, campaigns);
    const campaignIds = new Set(campaigns.map((c) => c.id));
    const rawProjects = load<unknown[]>(STORAGE_KEYS.projects, []);
    const projects = migrateProjects(rawProjects).filter((p) => p.companyId === companyId && campaignIds.has(p.campaignId));
    save(STORAGE_KEYS.projects, projects);
    const jobs = load<JobRecord[]>(STORAGE_KEYS.jobs, []).filter((j) => j.companyId === companyId);
    save(STORAGE_KEYS.jobs, jobs);
    const payrollSettings = load<PayrollPeriodSettings[]>(STORAGE_KEYS.payrollPeriodSettings, []).filter((s) => s.companyId === companyId);
    save(STORAGE_KEYS.payrollPeriodSettings, payrollSettings);
    const teamIds = new Set(teams.map((t) => t.id));
    const teamAllocs = load<TeamMaterialAllocation[]>(STORAGE_KEYS.teamMaterialAllocations, []).filter((a) => teamIds.has(a.teamId));
    save(STORAGE_KEYS.teamMaterialAllocations, teamAllocs);
    const materialAuditLog = load<MaterialAuditLogEntry[]>(STORAGE_KEYS.materialAuditLog, []).filter((e) => e.companyId === companyId);
    save(STORAGE_KEYS.materialAuditLog, materialAuditLog);
  },
};

export type { Role, ApprovalStatus, JobStatus };
