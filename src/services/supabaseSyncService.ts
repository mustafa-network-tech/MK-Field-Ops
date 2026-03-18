/**
 * Sync company data between local store and Supabase.
 * - fetchCompanyDataFromSupabase: load campaigns, teams, projects, jobs, etc. from DB (e.g. on login from another device).
 * - pushCompanyDataToSupabase: upload current store data to Supabase (one-time "Sync to cloud" from device that has data).
 */

import { supabase } from './supabaseClient';
import { store } from '../data/store';
import type {
  Campaign,
  Vehicle,
  Equipment,
  WorkItem,
  Team,
  Project,
  JobRecord,
  JobMaterialUsage,
  MaterialStockItem,
} from '../types';

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Tek stok satırını DB şemasına map et (push / anlık senkron). */
export function materialStockItemToDbRow(m: MaterialStockItem, companyId: string): Record<string, unknown> | null {
  if (!isUuid(m.id) || !isUuid(companyId)) return null;
  return {
    id: m.id,
    company_id: companyId,
    main_type: m.mainType,
    custom_group_name: m.customGroupName ?? null,
    name: m.name,
    size_or_capacity: m.sizeOrCapacity ?? null,
    stock_qty: m.stockQty ?? null,
    is_cable: m.isCable ?? false,
    cable_category: m.cableCategory ?? null,
    capacity_label: m.capacityLabel ?? null,
    spool_id: m.spoolId ?? null,
    length_total: m.lengthTotal ?? null,
    length_remaining: m.lengthRemaining ?? null,
    is_external: m.isExternal ?? false,
    external_note: m.externalNote ?? null,
    created_at: m.createdAt,
  };
}

/**
 * İrsaliye tesliminden sonra stok + irsaliye kayıtlarını Supabase'e yazar.
 * Aksi halde bir sonraki girişte fetch eski stoku getirip yerel teslimi siler gibi görünür.
 */
export async function persistDeliveryReceiveToSupabase(
  companyId: string,
  noteId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !isUuid(companyId)) return { ok: false, error: 'skip' };
  const note = store.getDeliveryNote(noteId);
  if (!note || note.companyId !== companyId) return { ok: false, error: 'note not found' };
  if (!isUuid(note.id)) return { ok: false, error: 'invalid note id' };

  const items = store.getDeliveryNoteItems(noteId);
  const stockIds = [...new Set(items.map((i) => i.materialStockItemId))];
  const allStock = store.getMaterialStock(companyId);
  const stockRows = stockIds
    .map((sid) => allStock.find((m) => m.id === sid))
    .map((m) => (m ? materialStockItemToDbRow(m, companyId) : null))
    .filter(Boolean) as Record<string, unknown>[];

  if (stockRows.length) {
    const { error } = await supabase.from('material_stock').upsert(stockRows, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
  }

  const receivedDate =
    note.receivedDate && note.receivedDate.length >= 10 ? note.receivedDate.slice(0, 10) : note.receivedDate;
  const { error: eNote } = await supabase.from('delivery_notes').upsert(
    {
      id: note.id,
      company_id: companyId,
      supplier: note.supplier,
      received_date: receivedDate,
      irsaliye_no: note.irsaliyeNo,
      received_by: note.receivedBy && isUuid(note.receivedBy) ? note.receivedBy : null,
      received_at: note.receivedAt ?? null,
      created_at: note.createdAt,
    },
    { onConflict: 'id' }
  );
  if (eNote) return { ok: false, error: eNote.message };

  const itemRows = items
    .filter((it) => isUuid(it.id) && isUuid(it.materialStockItemId))
    .map((it) => ({
      id: it.id,
      delivery_note_id: note.id,
      material_stock_item_id: it.materialStockItemId,
      quantity: it.quantity,
      quantity_unit: it.quantityUnit,
      created_at: it.createdAt,
    }));
  if (itemRows.length) {
    const { error: eItems } = await supabase.from('delivery_note_items').upsert(itemRows, { onConflict: 'id' });
    if (eItems) return { ok: false, error: eItems.message };
  }

  return { ok: true };
}

/** Merkez stok miktarı değişince (dağıtım, iade) tek kalemi buluta yazar. */
export async function syncMaterialStockItemToSupabase(companyId: string, materialStockItemId: string): Promise<void> {
  if (!supabase || !isUuid(companyId) || !isUuid(materialStockItemId)) return;
  const m = store.getMaterialStock(companyId).find((x) => x.id === materialStockItemId);
  if (!m) return;
  const row = materialStockItemToDbRow(m, companyId);
  if (!row) return;
  await supabase.from('material_stock').upsert(row, { onConflict: 'id' });
}

/** Map DB row (snake_case) to app type (camelCase). */
function mapCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

function mapVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    plateNumber: row.plate_number as string,
    brand: row.brand as string,
    model: row.model as string,
    description: row.description as string | undefined,
  };
}

function mapEquipment(row: Record<string, unknown>): Equipment {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    code: row.code as string,
    description: (row.description as string) ?? '',
  };
}

function mapWorkItem(row: Record<string, unknown>): WorkItem {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    code: row.code as string,
    unitType: row.unit_type as string,
    unitPrice: Number(row.unit_price) ?? 0,
    description: (row.description as string) ?? '',
  };
}

function mapTeam(row: Record<string, unknown>): Team {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    code: row.code as string,
    description: row.description as string | undefined,
    percentage: Number(row.percentage) ?? 0,
    createdBy: row.created_by as string,
    approvalStatus: (row.approval_status as Team['approvalStatus']) ?? 'pending',
    approvedBy: row.approved_by as string | undefined,
    leaderId: row.leader_id as string | undefined,
    memberIds: Array.isArray(row.member_ids) ? (row.member_ids as string[]) : [],
    membersManual: Array.isArray(row.members_manual)
      ? (row.members_manual as Team['membersManual'])
      : [],
    vehicleId: row.vehicle_id as string | undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    wipedAt: (row.wiped_at as string) ?? null,
  };
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    campaignId: row.campaign_id as string,
    projectYear: Number(row.project_year) ?? new Date().getFullYear(),
    externalProjectId: (row.external_project_id as string) ?? '',
    receivedDate: (row.received_date as string) ?? new Date().toISOString().slice(0, 10),
    name: row.name as string | undefined,
    description: row.description as string | undefined,
    status: (row.status as Project['status']) ?? 'ACTIVE',
    completedAt: row.completed_at as string | undefined,
    completedBy: row.completed_by as string | undefined,
    createdBy: row.created_by as string,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

function mapMaterialUsage(u: Record<string, unknown>): JobMaterialUsage {
  return {
    teamZimmetId: u.team_zimmet_id as string | undefined,
    materialStockItemId: u.material_stock_item_id as string | undefined,
    isExternal: Boolean(u.is_external),
    externalDescription: u.external_description as string | undefined,
    quantity: Number(u.quantity) ?? 0,
    quantityUnit: (u.quantity_unit as 'm' | 'pcs') ?? 'pcs',
  };
}

function mapJob(row: Record<string, unknown>): JobRecord {
  const usages = row.material_usages;
  const materialUsages: JobMaterialUsage[] = Array.isArray(usages)
    ? (usages as Record<string, unknown>[]).map(mapMaterialUsage)
    : [];
  const notePhotos = (row as Record<string, unknown>).note_photos;
  const notePhotosArr = Array.isArray(notePhotos) ? (notePhotos as string[]) : null;

  return {
    id: row.id as string,
    companyId: row.company_id as string,
    date: (row.job_date as string) ?? new Date().toISOString().slice(0, 10),
    projectId: row.project_id as string | undefined,
    teamId: row.team_id as string,
    workItemId: row.work_item_id as string,
    quantity: Number(row.quantity) ?? 0,
    materialIds: Array.isArray(row.material_ids) ? (row.material_ids as string[]) : [],
    materialUsages: materialUsages.length ? materialUsages : undefined,
    equipmentIds: Array.isArray(row.equipment_ids) ? (row.equipment_ids as string[]) : [],
    notes: (row.notes as string) ?? '',
    notePhotos: notePhotosArr,
    status: (row.status as JobRecord['status']) ?? 'draft',
    stockDeducted: Boolean(row.stock_deducted),
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as string | undefined,
    rejectedBy: row.rejected_by as string | undefined,
    createdBy: row.created_by as string,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

function materialUsagesToDb(usages: JobMaterialUsage[] | undefined): Record<string, unknown>[] {
  return (usages ?? []).map((u) => ({
    team_zimmet_id: u.teamZimmetId ?? null,
    material_stock_item_id: u.materialStockItemId ?? null,
    is_external: u.isExternal,
    external_description: u.externalDescription ?? null,
    quantity: u.quantity,
    quantity_unit: u.quantityUnit,
  }));
}

/** Map material_stock row to MaterialStockItem (only columns present in DB). */
function mapMaterialStockItem(row: Record<string, unknown>): MaterialStockItem {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    mainType: (row.main_type as MaterialStockItem['mainType']) ?? 'custom',
    customGroupName: row.custom_group_name as string | undefined,
    name: (row.name as string) ?? '',
    sizeOrCapacity: row.size_or_capacity as string | undefined,
    stockQty: row.stock_qty != null ? Number(row.stock_qty) : undefined,
    isCable: Boolean(row.is_cable),
    cableCategory: (row.cable_category as MaterialStockItem['cableCategory']) ?? undefined,
    capacityLabel: row.capacity_label as string | undefined,
    spoolId: row.spool_id as string | undefined,
    lengthTotal: row.length_total != null ? Number(row.length_total) : undefined,
    lengthRemaining: row.length_remaining != null ? Number(row.length_remaining) : undefined,
    isExternal: Boolean(row.is_external),
    externalNote: row.external_note as string | undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

/**
 * Upsert a single entity to Supabase. No-op if supabase is not configured or id is not a valid UUID.
 * Call after store.addX / store.updateX so every change is persisted to the cloud.
 */
export async function upsertCampaign(c: Campaign): Promise<void> {
  if (!supabase || !isUuid(c.id)) return;
  await supabase.from('campaigns').upsert(
    { id: c.id, company_id: c.companyId, name: c.name, created_at: c.createdAt },
    { onConflict: 'id' }
  );
}

export async function upsertVehicle(v: Vehicle): Promise<void> {
  if (!supabase || !isUuid(v.id)) return;
  await supabase.from('vehicles').upsert(
    {
      id: v.id,
      company_id: v.companyId,
      plate_number: v.plateNumber,
      brand: v.brand,
      model: v.model,
      description: v.description ?? null,
    },
    { onConflict: 'id' }
  );
}

export async function upsertEquipment(e: Equipment): Promise<void> {
  if (!supabase || !isUuid(e.id)) return;
  await supabase.from('equipment').upsert(
    { id: e.id, company_id: e.companyId, code: e.code, description: e.description ?? '' },
    { onConflict: 'id' }
  );
}

export async function upsertWorkItem(w: WorkItem): Promise<void> {
  if (!supabase || !isUuid(w.id)) return;
  await supabase.from('work_items').upsert(
    {
      id: w.id,
      company_id: w.companyId,
      code: w.code,
      unit_type: w.unitType,
      unit_price: w.unitPrice,
      description: w.description ?? '',
    },
    { onConflict: 'id' }
  );
}

export async function upsertTeam(t: Team): Promise<void> {
  if (!supabase || !isUuid(t.id)) return;
  await supabase.from('teams').upsert(
    {
      id: t.id,
      company_id: t.companyId,
      code: t.code,
      description: t.description ?? null,
      percentage: t.percentage,
      created_by: t.createdBy || null,
      approval_status: t.approvalStatus,
      approved_by: t.approvedBy || null,
      leader_id: t.leaderId || null,
      member_ids: t.memberIds ?? [],
      members_manual: t.membersManual ?? [],
      vehicle_id: t.vehicleId || null,
      created_at: t.createdAt,
      wiped_at: t.wipedAt ?? null,
    },
    { onConflict: 'id' }
  );
}

export async function upsertProject(p: Project): Promise<void> {
  if (!supabase || !isUuid(p.id)) return;
  await supabase.from('projects').upsert(
    {
      id: p.id,
      company_id: p.companyId,
      campaign_id: p.campaignId,
      project_year: p.projectYear,
      external_project_id: p.externalProjectId,
      received_date: p.receivedDate,
      name: p.name ?? null,
      description: p.description ?? null,
      status: p.status,
      completed_at: p.completedAt ?? null,
      completed_by: p.completedBy ?? null,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    },
    { onConflict: 'id' }
  );
}

export async function upsertJob(j: JobRecord): Promise<void> {
  if (!supabase || !isUuid(j.id)) return;
  await supabase.from('jobs').upsert(
    {
      id: j.id,
      company_id: j.companyId,
      job_date: j.date,
      project_id: j.projectId || null,
      team_id: j.teamId,
      work_item_id: j.workItemId,
      quantity: j.quantity,
      material_ids: j.materialIds ?? [],
      material_usages: materialUsagesToDb(j.materialUsages),
      equipment_ids: j.equipmentIds ?? [],
      notes: j.notes ?? '',
      status: j.status,
      stock_deducted: j.stockDeducted ?? false,
      approved_by: j.approvedBy ?? null,
      approved_at: j.approvedAt ?? null,
      rejected_by: j.rejectedBy ?? null,
      created_by: j.createdBy,
      created_at: j.createdAt,
      updated_at: j.updatedAt,
    },
    { onConflict: 'id' }
  );
}

/**
 * Fetch company data from Supabase and merge into the local store.
 * Call after login/restore so the app has campaigns, projects, teams, jobs on any device.
 */
export async function fetchCompanyDataFromSupabase(companyId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !companyId) return { ok: false, error: 'Not configured or no company' };

  try {
    const [
      campaignsRes,
      vehiclesRes,
      equipmentRes,
      workItemsRes,
      teamsRes,
      projectsRes,
      jobsRes,
      materialStockRes,
    ] = await Promise.all([
      supabase.from('campaigns').select('*').eq('company_id', companyId),
      supabase.from('vehicles').select('*').eq('company_id', companyId),
      supabase.from('equipment').select('*').eq('company_id', companyId),
      supabase.from('work_items').select('*').eq('company_id', companyId),
      supabase.from('teams').select('*').eq('company_id', companyId),
      supabase.from('projects').select('*').eq('company_id', companyId),
      supabase.from('jobs').select('*').eq('company_id', companyId),
      supabase.from('material_stock').select('*').eq('company_id', companyId),
    ]);

    if (campaignsRes.error) return { ok: false, error: campaignsRes.error.message };
    if (vehiclesRes.error) return { ok: false, error: vehiclesRes.error.message };
    if (equipmentRes.error) return { ok: false, error: equipmentRes.error.message };
    if (workItemsRes.error) return { ok: false, error: workItemsRes.error.message };
    if (teamsRes.error) return { ok: false, error: teamsRes.error.message };
    if (projectsRes.error) return { ok: false, error: projectsRes.error.message };
    if (jobsRes.error) return { ok: false, error: jobsRes.error.message };
    if (materialStockRes.error) return { ok: false, error: materialStockRes.error.message };

    const campaigns = (campaignsRes.data ?? []).map(mapCampaign);
    const vehicles = (vehiclesRes.data ?? []).map(mapVehicle);
    const equipment = (equipmentRes.data ?? []).map(mapEquipment);
    const workItems = (workItemsRes.data ?? []).map(mapWorkItem);
    const teams = (teamsRes.data ?? []).map(mapTeam);
    const projects = (projectsRes.data ?? []).map(mapProject);
    const jobs = (jobsRes.data ?? []).map(mapJob);
    const materialStock = (materialStockRes.data ?? []).map(mapMaterialStockItem);

    store.replaceCompanyDataFromSupabase(companyId, {
      campaigns,
      vehicles,
      equipment,
      workItems,
      teams,
      projects,
      jobs,
      materialStock,
    });

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/**
 * Push current local store data for the company to Supabase (upsert by id).
 * Use when this device has data that is not yet in Supabase (e.g. first-time "Sync to cloud").
 * Local IDs that are not valid UUIDs are replaced with new UUIDs; references are updated.
 */
export async function pushCompanyDataToSupabase(companyId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !companyId) return { ok: false, error: 'Not configured or no company' };

  const newUuid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const campaigns = store.getCampaigns(companyId);
  const vehicles = store.getVehicles(companyId);
  const equipment = store.getEquipment(companyId);
  const workItems = store.getWorkItems(companyId);
  const teams = store.getTeams(companyId);
  const projects = store.getProjects(companyId);
  const jobs = store.getJobs(companyId);
  const materialStock = store.getMaterialStock(companyId);

  const campaignIdMap: Record<string, string> = {};
  const vehicleIdMap: Record<string, string> = {};
  const equipmentIdMap: Record<string, string> = {};
  const workItemIdMap: Record<string, string> = {};
  const teamIdMap: Record<string, string> = {};
  const projectIdMap: Record<string, string> = {};

  try {
    for (const c of campaigns) {
      const id = isUuid(c.id) ? c.id : newUuid();
      if (!isUuid(c.id)) campaignIdMap[c.id] = id;
      else campaignIdMap[c.id] = c.id;
    }
    for (const v of vehicles) {
      const id = isUuid(v.id) ? v.id : newUuid();
      if (!isUuid(v.id)) vehicleIdMap[v.id] = id;
      else vehicleIdMap[v.id] = v.id;
    }
    for (const e of equipment) {
      const id = isUuid(e.id) ? e.id : newUuid();
      if (!isUuid(e.id)) equipmentIdMap[e.id] = id;
      else equipmentIdMap[e.id] = e.id;
    }
    for (const w of workItems) {
      const id = isUuid(w.id) ? w.id : newUuid();
      if (!isUuid(w.id)) workItemIdMap[w.id] = id;
      else workItemIdMap[w.id] = w.id;
    }
    for (const t of teams) {
      const id = isUuid(t.id) ? t.id : newUuid();
      teamIdMap[t.id] = id;
    }
    for (const p of projects) {
      const id = isUuid(p.id) ? p.id : newUuid();
      projectIdMap[p.id] = id;
    }

    const campaignRows = campaigns.map((c) => ({
      id: campaignIdMap[c.id] ?? c.id,
      company_id: companyId,
      name: c.name,
      created_at: c.createdAt,
    }));
    const vehicleRows = vehicles.map((v) => ({
      id: vehicleIdMap[v.id] ?? v.id,
      company_id: companyId,
      plate_number: v.plateNumber,
      brand: v.brand,
      model: v.model,
      description: v.description ?? null,
    }));
    const equipmentRows = equipment.map((e) => ({
      id: equipmentIdMap[e.id] ?? e.id,
      company_id: companyId,
      code: e.code,
      description: e.description ?? '',
    }));
    const workItemRows = workItems.map((w) => ({
      id: workItemIdMap[w.id] ?? w.id,
      company_id: companyId,
      code: w.code,
      unit_type: w.unitType,
      unit_price: w.unitPrice,
      description: w.description ?? '',
    }));
    const teamRows = teams.map((t) => ({
      id: teamIdMap[t.id] ?? t.id,
      company_id: companyId,
      code: t.code,
      description: t.description ?? null,
      percentage: t.percentage,
      created_by: t.createdBy || null,
      approval_status: t.approvalStatus,
      approved_by: t.approvedBy || null,
      leader_id: t.leaderId || null,
      member_ids: t.memberIds ?? [],
      members_manual: t.membersManual ?? [],
      vehicle_id: t.vehicleId ? (vehicleIdMap[t.vehicleId] ?? t.vehicleId) : null,
      created_at: t.createdAt,
      wiped_at: t.wipedAt ?? null,
    }));
    const projectRows = projects.map((p) => ({
      id: projectIdMap[p.id] ?? p.id,
      company_id: companyId,
      campaign_id: campaignIdMap[p.campaignId] ?? p.campaignId,
      project_year: p.projectYear,
      external_project_id: p.externalProjectId,
      received_date: p.receivedDate,
      name: p.name ?? null,
      description: p.description ?? null,
      status: p.status,
      completed_at: p.completedAt ?? null,
      completed_by: p.completedBy ?? null,
      created_by: p.createdBy,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    }));

    const materialUsagesToDb = (usages: JobMaterialUsage[] | undefined) =>
      (usages ?? []).map((u) => ({
        team_zimmet_id: u.teamZimmetId ?? null,
        material_stock_item_id: u.materialStockItemId ?? null,
        is_external: u.isExternal,
        external_description: u.externalDescription ?? null,
        quantity: u.quantity,
        quantity_unit: u.quantityUnit,
      }));

    const jobRows = jobs.map((j) => ({
      id: isUuid(j.id) ? j.id : newUuid(),
      company_id: companyId,
      job_date: j.date,
      project_id: j.projectId ? (projectIdMap[j.projectId] ?? j.projectId) : null,
      team_id: teamIdMap[j.teamId] ?? j.teamId,
      work_item_id: workItemIdMap[j.workItemId] ?? j.workItemId,
      quantity: j.quantity,
      material_ids: j.materialIds ?? [],
      material_usages: materialUsagesToDb(j.materialUsages),
      equipment_ids: j.equipmentIds ?? [],
      notes: j.notes ?? '',
      status: j.status,
      stock_deducted: j.stockDeducted ?? false,
      approved_by: j.approvedBy ?? null,
      approved_at: j.approvedAt ?? null,
      rejected_by: j.rejectedBy ?? null,
      created_by: j.createdBy,
      created_at: j.createdAt,
      updated_at: j.updatedAt,
    }));

    if (campaignRows.length) {
      const { error } = await supabase.from('campaigns').upsert(campaignRows, { onConflict: 'id' });
      if (error) return { ok: false, error: `campaigns: ${error.message}` };
    }
    if (vehicleRows.length) {
      const { error } = await supabase.from('vehicles').upsert(vehicleRows, { onConflict: 'id' });
      if (error) return { ok: false, error: `vehicles: ${error.message}` };
    }
    if (equipmentRows.length) {
      const { error } = await supabase.from('equipment').upsert(equipmentRows, { onConflict: 'id' });
      if (error) return { ok: false, error: `equipment: ${error.message}` };
    }
    if (workItemRows.length) {
      const { error } = await supabase.from('work_items').upsert(workItemRows, { onConflict: 'id' });
      if (error) return { ok: false, error: `work_items: ${error.message}` };
    }
    if (teamRows.length) {
      const { error } = await supabase.from('teams').upsert(teamRows, { onConflict: 'id' });
      if (error) return { ok: false, error: `teams: ${error.message}` };
    }
    if (projectRows.length) {
      const { error } = await supabase.from('projects').upsert(projectRows, { onConflict: 'id' });
      if (error) return { ok: false, error: `projects: ${error.message}` };
    }
    if (jobRows.length) {
      const { error } = await supabase.from('jobs').upsert(jobRows, { onConflict: 'id' });
      if (error) return { ok: false, error: `jobs: ${error.message}` };
    }

    const materialStockRows = materialStock
      .map((m) => materialStockItemToDbRow(m, companyId))
      .filter(Boolean) as Record<string, unknown>[];
    if (materialStockRows.length) {
      const { error } = await supabase.from('material_stock').upsert(materialStockRows, { onConflict: 'id' });
      if (error) return { ok: false, error: `material_stock: ${error.message}` };
    }

    await fetchCompanyDataFromSupabase(companyId);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
