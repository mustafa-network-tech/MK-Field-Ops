export type Role = 'companyManager' | 'projectManager' | 'teamLeader';

export type JobStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Company {
  id: string;
  name: string;
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
  /** Ebat / kapasite / çap gibi serbest alan (örn. 6m, 110mm, 1x8) */
  sizeOrCapacity?: string;

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

export interface JobRecord {
  id: string;
  companyId: string;
  date: string;
  teamId: string;
  workItemId: string;
  quantity: number;
  materialIds: string[];
  equipmentIds: string[];
  notes: string;
  status: JobStatus;
  approvedBy?: string;
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
}
