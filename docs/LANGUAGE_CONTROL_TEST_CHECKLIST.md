# Language Control by Role – Test Checklist

## Scope
- **Company Manager (CM)** and **Project Manager (PM)**: can change company language; dropdown visible; change persists to Supabase and local store.
- **Team Leader (TL)**: cannot change language; dropdown **hidden**; UI always shows company’s chosen language.

---

## Pre-requisites
- [ ] Run DB migration: `supabase/migrations/20250302000002_company_language.sql` (adds `companies.language_code`, RLS).
- [ ] Ensure at least one Company Manager, one Project Manager, one Team Leader in the same company.

---

## 1. Team Leader
- [ ] Log in as **Team Leader**.
- [ ] **Dropdown not visible**: Top bar has no language selector (🌐 XX ▾).
- [ ] Navigate to Dashboard, My Jobs, Management (if allowed), then back: language does not change and no language control appears.
- [ ] Log out. Have a CM/PM set company language to e.g. **Turkish**. Log in again as **Team Leader**.
- [ ] **Company language applied**: UI is in Turkish (or whatever the company language is).
- [ ] Refresh page: still in company language.
- [ ] Log out and log in again: still in company language.

---

## 2. Company Manager / Project Manager
- [ ] Log in as **Company Manager** or **Project Manager**.
- [ ] **Dropdown visible**: Top bar shows e.g. **🌐 EN ▾** (or current company language).
- [ ] Open dropdown: list shows EN, TR, ES, FR, DE.
- [ ] Select another language (e.g. **TR**): UI switches to Turkish immediately; dropdown shows **🌐 TR ▾**.
- [ ] Refresh page: language remains TR (loaded from company/store).
- [ ] Log out and log in again: language is still TR (company setting).
- [ ] In Supabase (or DB): `companies.language_code` for that company is `'tr'`.

---

## 3. Cross-role consistency
- [ ] As **CM/PM**, set company language to **French (FR)**.
- [ ] Log out. Log in as **Team Leader** (same company).
- [ ] UI is in French; no language dropdown.
- [ ] Log in as **PM** in another tab/session: change language to **German (DE)**.
- [ ] Team Leader session: after **refresh**, UI is in German (company-wide).

---

## 4. New company
- [ ] Register a **new company** (new Company Manager).
- [ ] Company language defaults to **EN** (DB default + local store).
- [ ] Change language as CM: persists; after logout/login still correct.

---

## 5. Edge cases
- [ ] **Offline / Supabase unavailable**: As PM/CM, change language; UI updates and local store updates; after Supabase is back, next change still persists (or document that persistence requires Supabase).
- [ ] **Route changes**: Navigate between Dashboard, Jobs, Reports, etc.: language stays consistent (no flicker back to another locale).
- [ ] **Logout**: After logout, login page uses last UI locale or default; after login, company language is applied.

---

## Sign-off
- [ ] All above checked for **Team Leader**, **Project Manager**, **Company Manager**.
- [ ] RLS: with Supabase Auth + profiles, only CM/PM can update `companies`; TL can read (via own company).
