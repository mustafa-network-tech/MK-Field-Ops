# Company logos storage (Supabase)

Logo yüklemesi için Supabase Storage’da **company-logos** bucket’ının oluşturulması gerekir.

## Adımlar

1. [Supabase Dashboard](https://supabase.com/dashboard) → projenizi seçin.
2. Sol menüden **Storage**’a tıklayın.
3. **New bucket** butonuna tıklayın.
4. **Name:** `company-logos` yazın (tam olarak bu isim olmalı).
5. **Public bucket** seçeneğini işaretleyin (logolar public URL ile kullanılacak).
6. **Create bucket** ile oluşturun.

## Logo URL'nin veritabanına yazılması

Yüklenen logo dosyası Storage'da saklanır; panelde kalıcı görünmesi için **logo URL'si** `public.companies` tablosundaki **`logo_url`** alanına da yazılır (Ayarlar'da "Kaydet" ile). Bu sayede sayfa yenilense bile logo kaybolmaz. **`companies`** tablosu için RLS politikalarının, şirket yöneticisinin (Company Manager) bu şirketin `name` ve `logo_url` alanlarını **UPDATE** etmesine izin vermesi gerekir.

---

7. **RLS hatası** ("new row violates row-level security policy"): Storage için policy gerekir. Supabase Dashboard → **SQL Editor** → New query. Şu migration’ı çalıştırın: `supabase/migrations/20250301000002_company_logos_storage_policies.sql` (içeriğini yapıştırıp Run). Veya projede `supabase db push` / migration’ları çalıştırıyorsanız bu dosya otomatik uygulanır.

---

**EN:** Create bucket `company-logos` (Public). If you get "new row violates row-level security policy", run the SQL in `supabase/migrations/20250301000002_company_logos_storage_policies.sql` in Dashboard → SQL Editor (or apply migrations with `supabase db push`). The app also writes the logo URL to `companies.logo_url` on save so the logo persists after refresh; RLS on `companies` must allow UPDATE on `name` and `logo_url` for the company manager.
