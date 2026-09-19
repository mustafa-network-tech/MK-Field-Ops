type RegistrationDraft = { email: string; password: string; fullName: string; plan: string | null };
let draft: RegistrationDraft | null = null;
export function setRegistrationDraft(value: RegistrationDraft) { draft = { ...value }; }
export function getRegistrationDraft() { return draft; }
export function clearRegistrationDraft() { draft = null; }
