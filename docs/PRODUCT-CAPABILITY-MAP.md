# MK OPS PRODUCT CAPABILITY MAP

Kaynak incelemesi: 19 Eylül 2026. Bu envanter uygulama kodunu esas alır; canlı veritabanında migration uygulanmış olduğunu iddia etmez.

## Mimari ve sınırlar

React 18 / React Router 6 / TypeScript 5 / Vite 5 SPA. Kurulu sürümler: React 18.3.1, TypeScript 5.9.3, Vite 5.4.21. Supabase Auth, PostgreSQL RLS, Storage, Edge Functions; Vercel Node API uçları. Server Component veya sunucu middleware'i yok. AppProvider oturumu geri yükler; AppRoutes içindeki ProtectedRoute / SuperAdminRoute erişim ayrımını yapar. Veriler şirket kapsamlı yerel store ve Supabase senkron servisinde tutulur.

Roller: companyManager (şirket yöneticisi), projectManager (proje yöneticisi), teamLeader (ekip lideri), superAdmin (platform yönetimi). Ekip liderinin kapsamı lideri olduğu ekiplerdir; fiyat görünürlüğü ayrıca denetlenir. AuditLogs ekranı yalnız companyManager'a açıktır; servis yorumundaki daha geniş rol ifadesi ürün iddiası yapılmamıştır.

## Doğrulanmış yetenekler

| Yetenek / problem | Kanıt ve route | Kullanıcı / ilişki / arama niyeti |
| --- | --- | --- |
| Günlük saha kaydı: tarih, aktif proje, onaylı ekip, iş kalemi, miktar, malzeme, ekipman, not ve en fazla 3 fotoğraf | jobs/services/jobService.ts; jobs/pages/JobEntry.tsx; /jobs, /my-jobs | Ekip lideri ve yöneticiler; onaya veri sağlar; günlük iş takibi |
| Taslak, gönderildi, onaylandı, reddedildi; onayda zimmet kontrolü ve düşüm | jobService.updateJob; approvals/pages/Approvals.tsx; /approvals | CM/PM onaylar; stok ve hakedişle ilişkili; saha onay süreci |
| Birim fiyat × miktar, ekip yüzdesi, şirket payı; dönem başlangıcı ve dönem kilidi | jobCalculationService.ts; reports/services/payrollPeriodService.ts; /payroll | CM/PM dönem yönetir; TL kendi kapsamını görür; hakediş takibi, maaş bordrosu değildir |
| İrsaliye kabulü ve stok artışı; merkez stok, zimmet, iade, ekipler arası transfer | stock/pages/DeliveryNotes.tsx; materialStockService.ts; store.receiveDeliveryNote; /delivery-notes, /management | CM/PM; işte tüketimle ilişkili; irsaliye ve malzeme takibi; e-irsaliye entegrasyonu yok |
| Şirket/ekip dönem raporları, ekip seçimi, Excel ve PDF | reports/pages/Reports.tsx; payrollExportService.ts; /reports | CM/PM şirket, TL kapsamlı ekip raporu; operasyon raporlama |
| İş, malzeme ve rapor dışa aktarma olayları; tarih, aktör, nesne, ayrıntı | auditLogService.ts; auditLogFetchService.ts; settings/pages/AuditLogs.tsx; /audit-logs | CM ekranı; işlem geçmişi; tüm olayların eksiksiz/değiştirilemez kaydı iddia edilmez |
| Kampanya/proje, aktif/tamamlandı/arşiv, ekip lideri/üyeleri, ekip yüzdesi ve araç | ProjectsTab.tsx; TeamsTab.tsx; teamService.ts; /management, /team/:teamId | Rol ve şirket kapsamı; telekom/fiber operasyon düzeni |
| Araç, ekipman, iş kalemi katalogları, kullanıcı onayı, bildirim, şirket ayarları | vehicles, equipment, jobs/components/WorkItemsTab, users, settings, activityNotificationService | Operasyonu destekleyen gerçek kataloglar; GPS/filo telemetrisi/puantaj/İK yok |
| Gün/hafta/dönem toplamları ve bekleyen işler | dashboardSummaryService.ts; jobCalculationService.ts; / | Oturumlu dashboard; toplu operasyon görünümü |

Yukarıdaki özelliklerin yalnız genel açıklamaları public olarak güvenlidir. Şirket, kullanıcı, fiyat, stok, fotoğraf ve operasyon kayıtları public build'e alınmaz.

## Route haritası

- `/`: oturumsuz Landing, oturumlu Dashboard; korunacak.
- Public mevcut: `/pricing` (Landing kopyası), `/kullanim-kilavuzu`, `/gizlilik-politikasi`, `/kullanim-sartlari`, `/geri-odeme-politikasi`.
- Giriş/onboarding, indeks dışı: `/login`, `/register`, `/workspace`, `/forgot-password`, `/reset-password`, `/plan-and-payment`, `/pending-join`.
- Özel: `/jobs`, `/my-jobs`, `/management/*`, `/team/:teamId`, `/approvals`, `/reports`, `/delivery-notes`, `/settings`, `/payroll`, `/audit-logs`, `/super-admin`.
- API: `/api/create-pending-signup`, `/api/mock-payment-success`, `/api/supabase-functions`; public ürün içeriğine bağlanmaz.

## SEO başlangıç durumu / karar

Boş SPA HTML, ortak İngilizce metadata, www OG URL, canonical/schema yok; sitemap login/register ve mükerrer pricing içeriyor. Landing'de desteklenmeyen personel/vardiya, fiber ek noktası, enerji iddiaları ve canlı etiketli kurgusal dashboard var. Bunlar düzeltilecek.

Ana sayfa saha operasyonu hub'ı; yedi ayrı niyet: telekom/fiber bağlamı, günlük iş, onay, hakediş, stok/irsaliye, rapor, denetim. İçerik statik/config; build sırasında public bileşenlerden HTML üretimi. Private shell ayrı; auth ve DB değişmez.

## Ayrı güvenlik bulguları (SEO kapsamı dışında)

- authService yerel fallback parola saklaması base64 kullanıyor (hash değil). Production Supabase yapılandırmasının eksik olması bu fallback'i etkinleştirebilir.
- authService profil kurtarma akışları kullanıcı metadata'sından rol okuyabiliyor. RLS ve profil oluşturma politikaları ayrıca sunucu tarafında denetlenmeli; canlı yetki yükseltme testi yapılmadı.
- paidSignupApi VITE_MOCK_PAYMENT_SECRET değerini istemciye taşır; böyle bir değer gizli sayılamaz. Mock ödeme sunucusu secret yoksa bu başlık kontrolünü atlıyor. Production ödeme doğrulaması olarak pazarlanmaz.
- Yeni public katman bu modülleri veya verilerini import etmez. Bu bulgular nedeniyle auth/API/DB üzerinde kapsam dışı değişiklik yapılmaz.
