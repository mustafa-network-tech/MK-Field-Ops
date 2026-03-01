# Migration çalıştırma sırası

Supabase SQL Editor'da **aşağıdaki sırayla** tek tek çalıştırın. Dosya adı = `supabase/migrations/` içindeki tam ad.

---

## 1) 20250101 – Payroll ve companies (3 dosya)

| Sıra | Dosya adı |
|------|-----------|
| 1 | `20250101000001_payroll_period_schema.sql` |
| 2 | `20250101000002_payroll_period_functions.sql` |
| 3 | `20250101000003_payroll_period_jobs_trigger.sql` |

**Not:** 20250101 için sadece **000001, 000002, 000003** var. 000004, 000005, 000006, 000007 **yok**.

---

## 2) 20250301 – Company, logo, para birimi (3 dosya)

| Sıra | Dosya adı |
|------|-----------|
| 4 | `20250301000001_company_profile_logo.sql` |
| 5 | `20250301000002_company_logos_storage_policies.sql` |
| 6 | `20250301000003_currency_and_decimal.sql` |

---

## 3) 20250302 – Audit, dil, profiles, RLS (7 dosya)

| Sıra | Dosya adı |
|------|-----------|
| 7 | `20250302000001_audit_logs.sql` |
| 8 | `20250302000002_company_language.sql` |
| 9 | `20250302000003_profiles_for_auth.sql` |
| 10 | `20250302000004_rls_strict_multi_tenant.sql` |
| 11 | `20250302000005_companies_insert_and_unique_name.sql` |
| 12 | `20250302000006_companies_rls_ensure.sql` |
| 13 | `20250302000007_profiles_email_and_cm_select.sql` |

---

## 4) 20250401 – Tam şema + RLS (6 dosya)

| Sıra | Dosya adı |
|------|-----------|
| 14 | `20250401000001_campaigns_vehicles_equipment_work_items_materials.sql` |
| 15 | `20250401000002_teams_and_projects.sql` |
| 16 | `20250401000003_material_stock_allocations_audit.sql` |
| 17 | `20250401000004_delivery_notes.sql` |
| 18 | `20250401000005_jobs_and_payroll_period_settings.sql` |
| 19 | `20250401000006_rls_all_new_tables.sql` |

---

## Özet

- **20250101:** 000001 → 000002 → 000003 (2, 4, 5, 6, 7 **yok**).
- **20250301:** 000001 → 000002 → 000003.
- **20250302:** 000001 → 000002 → 000003 → 000004 → 000005 → 000006 → 000007.
- **20250401:** 000001 → 000002 → 000003 → 000004 → 000005 → 000006.

Toplam **19** migration; hepsini yukarıdaki sırayla çalıştırın.
