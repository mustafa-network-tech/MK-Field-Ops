# MK Field OPS

Telekom saha operasyonlarını tek merkezden yönetmek için geliştirilmiş, çok kiracılı (multi-tenant) bir SaaS uygulamasıdır. Şirketler; ekiplerini, projelerini, saha işlerini, malzeme stoklarını, onay süreçlerini, bordro dönemlerini ve raporlarını birbirinden izole çalışma alanlarında yönetir.

## Başlıca özellikler

- Şirket bazlı veri izolasyonu ve rol tabanlı yetkilendirme
- Şirket yöneticisi, proje yöneticisi, ekip lideri ve süper yönetici rolleri
- Ekip, proje, araç, ekipman, malzeme ve iş kalemi yönetimi
- Günlük saha işi girişi ve taslak / gönderildi / onaylandı / reddedildi akışı
- Malzeme teslim fişleri ve stok takibi
- Ekip kazancı, şirket payı ve bordro dönemi hesaplamaları
- Dashboard, denetim kayıtları, Excel ve PDF raporları
- Türkçe, İngilizce, Almanca, Fransızca ve İspanyolca arayüz
- Abonelik planı ve ödeme sonrası şirket aktivasyon akışı

## Teknolojiler

- React 18, TypeScript ve Vite 5
- React Router
- Supabase (Auth, PostgreSQL, Storage ve Edge Functions)
- `xlsx`, `jsPDF` ve `jspdf-autotable`
- Vercel API Functions ve Vercel dağıtım yapılandırması

## Gereksinimler

- Node.js 18 veya üzeri
- npm
- Çalışan bir Supabase projesi
- Veritabanı ve Edge Function işlemleri için isteğe bağlı olarak Supabase CLI

## Yerelde çalıştırma

1. Bağımlılıkları kurun:

   ```bash
   npm install
   ```

2. Ortam dosyasını oluşturun:

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   macOS / Linux:

   ```bash
   cp .env.example .env.local
   ```

3. `.env.local` dosyasındaki zorunlu Supabase değerlerini doldurun:

   ```env
   VITE_SUPABASE_URL=https://proje-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=supabase-anon-key
   ```

   Kullanılabilen diğer değişkenler ve açıklamaları `.env.example` dosyasındadır. Gerçek anahtarları repoya eklemeyin.

4. Geliştirme sunucusunu başlatın:

   ```bash
   npm run dev
   ```

5. Tarayıcıda [http://localhost:5173](http://localhost:5173) adresini açın.

> PowerShell çalıştırma ilkesi `npm.ps1` dosyasını engelliyorsa komutları `npm.cmd install` ve `npm.cmd run dev` biçiminde kullanabilirsiniz.

## Veritabanı kurulumu

Supabase migration dosyaları `supabase/migrations/` klasöründedir. Yeni bir ortam kurarken migration sırası ve dikkat edilmesi gereken noktalar için [`docs/MIGRATION_RUN_ORDER.md`](docs/MIGRATION_RUN_ORDER.md) dosyasını izleyin. Şema hakkında genel bilgi için [`docs/SUPABASE_FULL_SCHEMA_OVERVIEW.md`](docs/SUPABASE_FULL_SCHEMA_OVERVIEW.md) belgesine bakın.

Supabase CLI kullanacaksanız önce projeyi bağlayın:

```bash
npm run supabase:login
npm run supabase:link
```

Kayıt ve mock ödeme Edge Function'larını dağıtmak için:

```bash
npm run deploy:functions
```

## Kullanılabilir komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Vite geliştirme sunucusunu `5173` portunda başlatır. |
| `npm run build` | TypeScript kontrolünü çalıştırır ve production çıktısını `dist/` içine üretir. |
| `npm run preview` | Hazırlanan production build'ini yerelde önizler. |
| `npm run supabase:login` | Supabase CLI oturumu açar. |
| `npm run supabase:link` | Yerel projeyi bir Supabase projesine bağlar. |
| `npm run deploy:functions` | Kayıt ve mock ödeme Edge Function'larını dağıtır. |

## Proje yapısı

```text
api/                    Vercel serverless API uçları
docs/                   Kurulum, kullanım ve veritabanı belgeleri
public/                 Statik dosyalar ve tanıtım videosu
src/
  app/                  Router, layout, provider ve uygulama yapılandırması
  features/             Özellik bazlı sayfalar, bileşenler ve servisler
  lib/                  Supabase, i18n, izinler ve yerel saklama yardımcıları
  shared/               Ortak tipler, UI bileşenleri, servisler ve araçlar
supabase/
  functions/            Supabase Edge Function'ları
  migrations/           Veritabanı migration dosyaları
```

## Production build

```bash
npm run build
npm run preview
```

Build çıktısı `dist/` klasöründe oluşur. SPA yönlendirmeleri ve API route ayarları `vercel.json` içinde tanımlıdır.

## Ek belgeler

- [Kullanım kılavuzu](docs/KULLANIM-KILAVUZU.md)
- [Giriş ve üyelik kuralları](docs/GIRIS-VE-UYE-OL-KURALLARI.md)
- [Storage kurulumu](docs/STORAGE_SETUP.md)
- [Dil kontrol test listesi](docs/LANGUAGE_CONTROL_TEST_CHECKLIST.md)

## Güvenlik

- `.env` ve `.env.local` dosyalarını paylaşmayın veya commitlemeyin.
- `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucu tarafında kullanılmalıdır; hiçbir zaman `VITE_` önekiyle tanımlamayın.
- Production ortamında Supabase RLS politikalarını ve migration'ların eksiksiz uygulandığını doğrulayın.
