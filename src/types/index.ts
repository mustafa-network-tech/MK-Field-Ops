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
  role: Role;
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
