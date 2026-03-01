# Company logos storage (Supabase)

Logo yüklemesi için Supabase Storage’da **company-logos** bucket’ının oluşturulması gerekir.

## Adımlar

1. [Supabase Dashboard](https://supabase.com/dashboard) → projenizi seçin.
2. Sol menüden **Storage**’a tıklayın.
3. **New bucket** butonuna tıklayın.
4. **Name:** `company-logos` yazın (tam olarak bu isim olmalı).
5. **Public bucket** seçeneğini işaretleyin (logolar public URL ile kullanılacak).
6. **Create bucket** ile oluşturun.

7. **RLS hatası** ("new row violates row-level security policy"): Storage için policy gerekir. Supabase Dashboard → **SQL Editor** → New query. Şu migration’ı çalıştırın: `supabase/migrations/20250301000002_company_logos_storage_policies.sql` (içeriğini yapıştırıp Run). Veya projede `supabase db push` / migration’ları çalıştırıyorsanız bu dosya otomatik uygulanır.

---

**EN:** Create bucket `company-logos` (Public). If you get "new row violates row-level security policy", run the SQL in `supabase/migrations/20250301000002_company_logos_storage_policies.sql` in Dashboard → SQL Editor (or apply migrations with `supabase db push`).
