import { store } from '../data/store';
import type { Role } from '../types';

function hashPassword(p: string): string {
  return btoa(encodeURIComponent(p));
}

function checkPassword(plain: string, hashed: string): boolean {
  return hashPassword(plain) === hashed;
}

export const authService = {
  login(email: string, password: string, companyId?: string): { ok: boolean; error?: string } {
    const users = companyId ? store.getUsers(companyId) : store.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !checkPassword(password, user.passwordHash)) {
      return { ok: false, error: 'auth.loginError' };
    }
    if (user.roleApprovalStatus !== 'approved') {
      return { ok: false, error: 'auth.pendingApproval' };
    }
    store.setCurrentUserId(user.id);
    return { ok: true };
  },

  register(params: {
    email: string;
    password: string;
    fullName: string;
    companyName?: string;
    companyId?: string;
    role: Role;
  }): { ok: boolean; error?: string; needsApproval?: boolean } {
    const { email, password, fullName, companyName, companyId, role } = params;
    let cId = companyId;
    if (!cId && companyName) {
      const company = store.addCompany(companyName);
      cId = company.id;
    }
    if (!cId) return { ok: false, error: 'validation.required' };
    if (store.getUserByEmail(email, cId)) {
      return { ok: false, error: 'auth.emailExists' };
    }
    const isFirstUser = store.getUsers(cId).length === 0;
    const roleApprovalStatus = isFirstUser ? 'approved' : role === 'companyManager' ? 'approved' : 'pending';
    const finalRole = isFirstUser ? 'companyManager' : role;
    store.addUser({
      companyId: cId,
      email,
      passwordHash: hashPassword(password),
      fullName,
      role: finalRole,
      roleApprovalStatus,
      createdAt: new Date().toISOString(),
    });
    store.setCurrentUserId(store.getUsers(cId).find((u) => u.email === email)!.id);
    const needsApproval = !isFirstUser && (role === 'projectManager' || role === 'teamLeader');
    return { ok: true, needsApproval };
  },

  registerExistingCompany(params: {
    email: string;
    password: string;
    fullName: string;
    companyId: string;
    role: Role;
  }): { ok: boolean; error?: string; needsApproval?: boolean } {
    const { email, password, fullName, companyId, role } = params;
    if (store.getUserByEmail(email, companyId)) {
      return { ok: false, error: 'auth.emailExists' };
    }
    const roleApprovalStatus = role === 'projectManager' ? 'pending' : role === 'teamLeader' ? 'pending' : 'approved';
    store.addUser({
      companyId,
      email,
      passwordHash: hashPassword(password),
      fullName,
      role,
      roleApprovalStatus,
      createdAt: new Date().toISOString(),
    });
    const newUser = store.getUsers(companyId).find((u) => u.email === email)!;
    store.setCurrentUserId(newUser.id);
    const needsApproval = role === 'projectManager' || role === 'teamLeader';
    return { ok: true, needsApproval };
  },

  logout(): void {
    store.setCurrentUserId(null);
  },

  approveUser(userId: string, approverRole: 'companyManager' | 'projectManager'): boolean {
    const user = store.getUsers().find((u) => u.id === userId);
    if (!user || user.roleApprovalStatus !== 'pending') return false;
    if (user.role === 'projectManager') {
      if (approverRole !== 'companyManager') return false;
      store.updateUser(userId, { roleApprovalStatus: 'approved', approvedByCompanyManager: store.getCurrentUserId()! });
      return true;
    }
    if (user.role === 'teamLeader') {
      if (approverRole === 'companyManager') {
        store.updateUser(userId, { approvedByCompanyManager: store.getCurrentUserId()! });
        const u = store.getUsers(user.companyId).find((x) => x.id === userId)!;
        if (u.approvedByProjectManager) {
          store.updateUser(userId, { roleApprovalStatus: 'approved' });
        }
        return true;
      }
      if (approverRole === 'projectManager') {
        store.updateUser(userId, { approvedByProjectManager: store.getCurrentUserId()! });
        const u = store.getUsers(user.companyId).find((x) => x.id === userId)!;
        if (u.approvedByCompanyManager) {
          store.updateUser(userId, { roleApprovalStatus: 'approved' });
        }
        return true;
      }
    }
    return false;
  },

  rejectUser(userId: string): boolean {
    return store.updateUser(userId, { roleApprovalStatus: 'rejected' }) != null;
  },
};
