export type Role = 'companyManager' | 'projectManager' | 'teamLeader';

export type JobStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/** Supported company UI language. Only CM/PM can change; TL sees company setting. */
export type CompanyLanguageCode = 'en' | 'tr' | 'es' | 'fr' | 'de';

/** Plan tier; stored on company, not user. */
export type CompanyPlan = 'starter' | 'professional' | 'enterprise';

export interface Company {
  id: string;
  name: string;
  /** Public URL of company logo (e.g. Supabase Storage). Optional. */
  logo_url?: string | null;
  /** Company-wide UI language. Default 'en'. Only Company Manager / Project Manager can change. */
  language_code?: CompanyLanguageCode;
  /** 4-digit join code; only used in onboarding and by company manager in settings. Not shown in panel UI. */
  join_code?: string | null;
  /** Plan tied to company. */
  plan?: CompanyPlan | null;
  billing_cycle?: 'monthly' | 'yearly' | null;
  plan_status?: string | null;
  trial_end_date?: string | null;
  owner_user_id?: string | null;
  /** Subscription period start (ISO date or datetime). */
  plan_start_date?: string | null;
  /** Subscription period end (ISO date or datetime). When reached, company enters SUSPENDED; after grace period, CLOSED. */
  plan_end_date?: string | null;
  /** Scheduled downgrade: applied at plan_end_date. Null if no pending change. */
  pending_plan?: CompanyPlan | null;
  /** Billing cycle for pending_plan when applied: monthly | yearly. */
  pending_plan_billing_cycle?: 'monthly' | 'yearly' | null;
  /** active = normal; suspended = expired, grace period; closed = suspended + 15 days, access blocked. */
  subscription_status?: 'active' | 'suspended' | 'closed' | null;
  createdAt: string;
}

export interface User {
  id: string;
  companyId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  /** Set when approved; pending users have no role until company manager assigns. */
  role?: Role;
  roleApprovalStatus: ApprovalStatus;
  approvedByCompanyManager?: string;
  approvedByProjectManager?: string;
  /** Team Leader only: when true, CM/PM has granted price visibility (unit prices, totals, earnings). */
  canSeePrices?: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
}

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface Project {
  id: string;
  companyId: string;
  campaignId: string;
  /** Year (2000–2100). Part of display key. */
  projectYear: number;
  /** External ID from institution (Telecom/Municipality). Trimmed; multiple spaces collapsed. */
  externalProjectId: string;
  /** Date project was received (YYYY-MM-DD). */
  receivedDate: string;
  name?: string | null;
  description?: string | null;
  status: ProjectStatus;
  /** Set when status becomes COMPLETED. */
  completedAt?: string | null;
  /** User id who marked project completed (CM/PM). */
  completedBy?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  companyId: string;
  plateNumber: string;
  brand: string;
  model: string;
  description?: string;
}

export interface TeamManualMember {
  fullName: string;
  phoneNumber: string;
  role?: string;
}

export interface Team {
  id: string;
  companyId: string;
  code: string;
  description?: string;
  percentage: number;
  createdBy: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  leaderId?: string;
  memberIds: string[];
  membersManual: TeamManualMember[];
  vehicleId?: string;
  createdAt: string;
  /** Set when team is wiped/archived; hidden from active lists; same code can be reused. */
  wipedAt?: string | null;
}

/**
 * Malzeme stok tipi:
 * - Ana tür + isteğe bağlı alt kategori (kablo iç/yeraltı/havai gibi)
 * - Esnek ama zor kuralları taşıyacak şekilde tasarlandı.
 */
export type MaterialMainType =
  | 'direk'
  | 'kablo_ic'
  | 'kablo_yeraltı'
  | 'kablo_havai'
  | 'boru'
  | 'fiber_bina_kutusu'
  | 'ofsd'
  | 'sonlandirma_paneli'
  | 'daire_sonlandirma_kutusu'
  | 'menhol'
  | 'ek_odasi'
  | 'koruyucu_fider_borusu'
  | 'custom';

export type CableCategory = 'ic' | 'yeraltı' | 'havai';

export interface MaterialStockItem {
  id: string;
  companyId: string;
  mainType: MaterialMainType;
  /** Özel malzeme türleri için gruplayıcı isim (ör: "Merdiven", "Kanal Açma Takımı") */
  customGroupName?: string;

  /** Genel görünen ad / açıklama (direk adı, boru adı, kutu açıklaması vb.) */
  name: string;
  /** Eski: Ebat / kapasite / çap gibi serbest alan (örn. 6m, 110mm, 1x8).
   *  Yeni dinamik sistemde çoğunlukla "Malzeme Ebatı" için kullanılır. */
  sizeOrCapacity?: string;

  /** Yeni dinamik sistem: serbest "Malzeme Cinsi" bilgisi (örn. nervürlü, 12FO, cam). */
  materialTypeLabel?: string;

  /** Yeni dinamik sistem: aynı stok kalemi altında biriken isteğe bağlı Malzeme ID listesi (örn. makara, seri no). */
  materialDetailIds?: string[];

  /** Yeni dinamik sistem: bu stok kalemi için kullanılan birim (adet / metre / kilo / metreküp). */
  unitDisplay?: 'adet' | 'metre' | 'kilo' | 'metreküp';

  /** Adet bazlı stok (direk, boru, kutu vb. için). Sıfırdan küçük olamaz. */
  stockQty?: number;

  /** Kabloya özel alanlar */
  isCable?: boolean;
  cableCategory?: CableCategory;
  /** Örn. 2x4, 4x16 vb. */
  capacityLabel?: string;
  /** Makara ID – benzersiz ve zorunlu (kablo için). */
  spoolId?: string;
  /** Makaranın toplam metre uzunluğu. */
  lengthTotal?: number;
  /** Kalan metre. Hiçbir zaman sıfırın altına düşmemeli. */
  lengthRemaining?: number;

  /** Harici / mevcut malzeme kullanıldı işaretlemesi. */
  isExternal?: boolean;
  externalNote?: string;

  createdAt: string;
}

/**
 * Ekip zimmeti: merkezden ekibe dağıtılan malzeme.
 * Kablo için quantityMeters, diğerleri için quantityPcs kullanılır.
 * Dağıtım yapılınca merkez stoktan (lengthRemaining / stockQty) düşülür.
 */
export interface TeamMaterialAllocation {
  id: string;
  companyId: string;
  teamId: string;
  materialStockItemId: string;
  /** Kablo için metre */
  quantityMeters?: number;
  /** Adet ile stoklanan malzemeler için */
  quantityPcs?: number;
  createdAt: string;
}

/** İrsaliye: teslim alındığında oluşturulur; sonradan düzenlenemez. */
export interface DeliveryNote {
  id: string;
  companyId: string;
  supplier: string;
  receivedDate: string;
  irsaliyeNo: string;
  /** Teslim alan kullanıcı (userId). Teslim sonrası ekleme/çıkarma/düzenleme yapılamaz. */
  receivedBy?: string;
  receivedAt?: string;
  createdAt: string;
}

/** İrsaliye kalemi: teslim alındığında stok kalemi bulunur/oluşturulur ve miktar eklenir. */
export interface DeliveryNoteItem {
  id: string;
  deliveryNoteId: string;
  materialStockItemId: string;
  quantity: number;
  quantityUnit: 'm' | 'pcs';
  /** Kullanıcının seçtiği birim (adet, metre, kilo, metreküp) – sadece gösterim amaçlı. */
  unitDisplay?: 'adet' | 'metre' | 'kilo' | 'metreküp';
  /** İrsaliye satırında girilen isteğe bağlı Malzeme ID (makara, seri numarası vb.). */
  materialDetailId?: string | null;
  createdAt: string;
}

/** Malzeme hareketi denetim kaydı */
export type MaterialAuditActionType =
  | 'STOCK_ADD'
  | 'STOCK_EDIT'
  | 'STOCK_DELETE'
  | 'DISTRIBUTE_TO_TEAM'
  | 'RETURN_TO_STOCK'
  | 'TRANSFER_BETWEEN_TEAMS'
  | 'STOCK_ADJUSTMENT'
  | 'DELIVERY_NOTE_RECEIVE';

export interface MaterialAuditLogEntry {
  id: string;
  companyId: string;
  actionType: MaterialAuditActionType;
  actorUserId: string;
  actorRole: string;
  materialStockItemId: string;
  fromTeamId?: string | null;
  toTeamId?: string | null;
  qtyCount?: number | null;
  qtyMeters?: number | null;
  spoolId?: string | null;
  note?: string | null;
  createdAt: string;
}

/** Eski basit malzeme kaydı (bazı ekranlarda hâlâ kullanılabilir). */
export interface Material {
  id: string;
  companyId: string;
  code: string;
  price: number;
}

export interface Equipment {
  id: string;
  companyId: string;
  code: string;
  description: string;
}

export interface WorkItem {
  id: string;
  companyId: string;
  code: string;
  unitType: string;
  unitPrice: number;
  description: string;
}

/** Job material usage: from team ZIMMET (assigned) or external. */
export interface JobMaterialUsage {
  /** When ZIMMET: reference to TeamMaterialAllocation id. Deduction uses this. */
  teamZimmetId?: string | null;
  /** Material stock item id (for display; can be derived from zimmet when teamZimmetId set) */
  materialStockItemId?: string | null;
  /** External / non-stock material (description required) */
  isExternal: boolean;
  /** Required when isExternal true */
  externalDescription?: string | null;
  quantity: number;
  quantityUnit: 'm' | 'pcs';
}

export interface JobRecord {
  id: string;
  companyId: string;
  date: string;
  /** Reference to projects.id (required for job submission; optional for legacy records) */
  projectId?: string;
  teamId: string;
  workItemId: string;
  quantity: number;
  materialIds: string[];
  /** Yeni malzeme kullanımı: stok + miktar veya harici + açıklama */
  materialUsages?: JobMaterialUsage[];
  equipmentIds: string[];
  notes: string;
  /** Base64 data URLs of optional note photos (camera or file upload). Max 3. */
  notePhotos?: string[] | null;
  /** @deprecated Use notePhotos. Kept for backward compatibility. */
  notePhoto?: string | null;
  status: JobStatus;
  /** Stok düşümü sadece onay sonrası yapılır; bir kez yapıldığında true */
  stockDeducted?: boolean;
  approvedBy?: string;
  /** Set when status becomes 'approved'. */
  approvedAt?: string | null;
  rejectedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobWithDetails extends JobRecord {
  totalWorkValue: number;
  teamEarnings: number;
  companyShare: number;
  teamPercentage: number;
  /** Work item unit price (full). For TL display use unitPrice * teamPercentage/100. */
  unitPrice: number;
}

/** Payroll (Hakediş) period settings per company. */
export interface PayrollPeriodSettings {
  companyId: string;
  /** Day of month when period starts (e.g. 20 → period runs 20th to 19th next month). */
  startDayOfMonth: number;
  updatedBy: string;
  updatedAt: string;
}

/** Activity notification for Company Manager (e.g. PM approved job, PM created team, new user pending). */
export type NotificationType = 'pm_job_approved' | 'pm_team_created' | 'pm_team_approved' | 'new_user_pending';

export interface ActivityNotification {
  id: string;
  companyId: string;
  type: NotificationType;
  /** i18n key for title (params in meta). */
  titleKey: string;
  meta: Record<string, string>;
  read: boolean;
  /** Set when marked read; notification is deleted 24h after this. */
  readAt?: string | null;
  createdAt: string;
}
