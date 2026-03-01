# Supabase – Tam veritabanı şeması ve migration sırası

## Mevcut migration’lar (zaten var)

- **companies** – logo_url, language_code, timezone, payroll_start_day (20250301, 20250101)
- **profiles** – id→auth.users, company_id, role, full_name, role_approval_status, email (20250302)
- **audit_logs** – actor, action, entity_type, entity_id, meta (20250302)
- **payroll_periods** – company_id, start_date, end_date, is_locked (20250101)
- **payroll_period_jobs_trigger** – job eklenince payroll_period_id atanır (20250101)

## Yeni migration’larla eklenecek tablolar (sırayla)

| Sıra | Migration | Tablolar | Bağımlılık |
|------|-----------|----------|------------|
| 1 | 20250401000001 | campaigns, vehicles, equipment, work_items, materials | companies |
| 2 | 20250401000002 | teams, projects | companies, profiles, vehicles, campaigns |
| 3 | 20250401000003 | material_stock, team_material_allocations, material_audit_log | companies, teams |
| 4 | 20250401000004 | delivery_notes, delivery_note_items | companies, material_stock, profiles |
| 5 | 20250401000005 | jobs, payroll_period_settings | companies, projects, teams, work_items, payroll_periods |
| 6 | 20250401000006 | Tüm yeni tablolar için RLS | profiles (company_id, role) |

## Roller ve erişim

- **companyManager (CM):** Şirket verisinde tam yetki (CRUD, onaylar).
- **projectManager (PM):** CM ile aynı iş verisi; kullanıcı onayı sadece CM’de olabilir (uygulama kuralı).
- **teamLeader (TL):** Sadece kendi ekipleri (teams.leader_id = auth.uid()); sadece kendi ekiplerinin işleri; fiyat görünürlüğü can_see_prices ile.

## RLS özeti

- **Ortak:** `company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())`.
- **teams:** TL için ek koşul: `leader_id = auth.uid()`.
- **jobs:** TL için: `team_id IN (SELECT id FROM teams WHERE company_id = ... AND leader_id = auth.uid())`.
- **team_material_allocations:** TL için: team_id kendi ekiplerinde.

## Çalıştırma sırası

Mevcut migration’lar + yeni dosyalar sırayla:

1. 20250101* (payroll schema, functions, trigger)
2. 20250301* (company, storage, currency)
3. 20250302* (audit_logs, company_language, profiles, rls, companies_insert, profiles_email)
4. **20250401000001** … **20250401000006** (yeni tam şema + RLS)

Supabase CLI: `supabase db push` veya SQL Editor’da 20250401000001 … 000006 dosyalarını sırayla çalıştırın.

### Sık hatalar ve çözümler

- **`relation "public.companies" does not exist`** → Önce 20250101000001, 20250301000001, 20250302000001 migration'larını çalıştırın.
- **`relation "public.profiles" does not exist`** → 20250302000001 ve 20250302000003 (profiles tablosu).
- **`function jobs_resolve_payroll_period() does not exist`** → 20250101000003 (trigger fonksiyonu).
- **Trigger syntax error** → 20250401000005'te `EXECUTE PROCEDURE` kullanılıyor; Postgres 14+ ise `EXECUTE FUNCTION` deneyin.

**jobs tablosu:** Tarih sütunu veritabanında **job_date**; uygulama `date` kullanıyorsa Supabase okur/yazarken eşleyin.
