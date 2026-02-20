# Telecom Field Tracker – Multi-Tenant SaaS

Multi-tenant web application for telecom field job tracking with full **English / Turkish** bilingual support. Language can be switched from the top bar without page reload.

## Run locally

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

- **Build:** `npm run build`
- **Preview build:** `npm run preview`

## Features

- **Multi-tenant:** Data isolated by Company ID. First user of a company becomes Company Manager.
- **Roles (3 only):** Company Manager, Project Manager, Team Leader.
- **Registration & approval:**
  - New company → first user = Company Manager (auto).
  - Project Manager → needs Company Manager approval.
  - Team Leader → needs both Company Manager and Project Manager approval.
- **Teams:** Team Code, Description, adjustable percentage. Team Leader-created teams need one approval (Company Manager or Project Manager).
- **Catalogs (editable by Company Manager & Project Manager):** Materials (code, price), Equipment (code, description), Work Items (unit type, unit price, description).
- **Daily job entry:** Date, Team, Work Item, Quantity, Used Materials, Used Equipment, Notes. Status: Draft → Submitted → Approved/Rejected. One approval from Company Manager or Project Manager.
- **Financials:** Total Work Value = Quantity × Unit Price; Team Earnings = Total × Team %; Company Share = remainder. Shown on dashboard and reports.
- **Dashboard:** Daily/Weekly/Monthly totals, pending approvals, approved jobs, team and company earnings.
- **UI:** Top bar with user name + active role (e.g. “Mustafa Öner – Company Manager”), Management Panel, Excel Export, EN/TR language switch.

## Tech stack

- **React 18** + **TypeScript**
- **Vite**
- **React Router**
- **JSON i18n** (EN/TR), global language state, no hardcoded UI strings
- **LocalStorage** data layer (ready to swap for Node.js / Supabase)
- **xlsx** for Excel export

## Project structure

- `src/i18n/` – locales (en.json, tr.json), `I18nContext` (language state, `t()`)
- `src/types/` – shared types (User, Company, Team, Job, Catalog, etc.)
- `src/data/store.ts` – persistence (company-scoped reads/writes)
- `src/services/` – auth, job calculations, Excel export
- `src/context/AppContext.tsx` – current user & company
- `src/components/` – TopBar, Layout, UI primitives, management tabs
- `src/pages/` – Login, Register, Dashboard, Job Entry, My Jobs, Management, Approvals, Reports

To add another language: add a new JSON under `src/i18n/locales/` and extend the `Locale` type and `messages` map in `I18nContext.tsx`.
