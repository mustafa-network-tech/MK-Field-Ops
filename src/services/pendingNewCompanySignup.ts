/**
 * Kayıt → workspace (yeni şirket) → ödeme sayfası akışında kullanıcı henüz oluşturulmadan
 * form verisini taşır. Ödeme adımı onaylandıktan sonra registerNewCompany ile tamamlanır.
 */
const STORAGE_KEY = 'mkfieldops_pending_new_company_v1';

export type PendingNewCompanyPayload = {
  v: 1;
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  joinCode: string;
};

export function setPendingNewCompanySignup(payload: Omit<PendingNewCompanyPayload, 'v'>): void {
  const data: PendingNewCompanyPayload = { v: 1, ...payload };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getPendingNewCompanySignup(): PendingNewCompanyPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<PendingNewCompanyPayload>;
    if (o.v !== 1 || typeof o.email !== 'string' || typeof o.password !== 'string') return null;
    if (typeof o.fullName !== 'string' || typeof o.companyName !== 'string' || typeof o.joinCode !== 'string') return null;
    if (!/^\d{4}$/.test(String(o.joinCode).trim())) return null;
    return o as PendingNewCompanyPayload;
  } catch {
    return null;
  }
}

export function clearPendingNewCompanySignup(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
