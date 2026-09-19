# MK OPS security remediation — review paketi

19 Eylül 2026. Değişiklikler yereldir. Production deploy, commit/push veya production DB migration yapılmadı.

## Kapatılan yollar

| Bulgu | Uygulanan düzeltme | Mevcut kullanıcı etkisi |
| --- | --- | --- |
| Metadata ile rol/yetki yükseltme | Metadata’dan profil oluşturma, upsert ve rol/approval onarma kaldırıldı. Login yalnız Auth kimliğiyle eşleşen onaylı DB profili kabul eder. Migration signup trigger’ını rolsüz, şirketsiz, pending profil üretmeye sınırlar; istemci profil INSERT/upsert ve superAdmin ataması engellenir. | Mevcut geçerli DB profilleri değiştirilmez. Profili eksik/tutarsız kullanıcı artık otomatik olarak yetkilendirilmez; yetkili operatör incelemesi gerekir. |
| Mock ödeme/onboarding | İstemci çağrıları reddedilir; üç Vercel endpoint’i ve iki Edge endpoint’i 503 döndürür. Ortak aktivasyon yardımcıları da kapalıdır. Secret header/proxy ve service-role aktivasyon kodu kaldırıldı. Migration eski mock endpoint’in claim RPC yetkisini de kaldırır. | Yeni ücretli şirket kaydı tüm ortamlarda kapalıdır. Mevcut şirketlerin operasyon hesaplamaları değiştirilmedi. Gerçek ödeme entegrasyonu eklenmedi. |
| Base64/localStorage auth | Yerel parola doğrulama/kayıt fallback’i tamamen kaldırıldı. Supabase yapılandırması yoksa giriş reddedilir. Eski passwordHash değerleri temizlenir; yeni kayıt parolası yalnız geçici JS belleğinde tutulur. Eski ödeme sessionStorage kayıtları okunmadan temizlenir. | Yerel/demo kullanıcıları ve doğrulanamayan offline oturumlar artık erişim sağlayamaz. Workspace sayfası yenilenirse kayıt formu yeniden doldurulur; parola history.state içine yazılmaz. |
| Session restore | Auth `getUser()` ve DB profil sorgusu ile kimlik, rol, şirket bağı ve approval doğrulanır. Pending/rejected/eksik/tutarsız profil reddedilir; yerel oturum ve tenant cache temizlenir. Provider cache’ten kullanıcı başlatmaz; guard’lar doğrulamayı bekler. | Dört geçerli rol korunur. DB/Auth doğrulaması başarısızsa fail closed uygulanır. Önceden onaylı, şirketten ayrılmış rolsüz kullanıcı yalnız mevcut PendingJoin akışına gider. |

Oturum sürümü, logout sırasında devam eden restore ve veri senkronizasyonunun eski kullanıcı/cache’i geri getirmesini engeller. `companyService.ts` ve `supabaseSyncService.ts` değişiklikleri yalnız gecikmiş cache yazımlarının bu kontrolüdür; hakediş/plan/iş/stok hesapları değiştirilmedi. Geçerli restore sırasında mevcut tenant cache korunur; başarısız doğrulamada temizlenir. Yerel cache içindeki henüz buluta aktarılmamış kayıtlar için offline çalışma garantisi verilmez.

## Migration içeriği — production’a uygulanmadı

Tam, incelemeye hazır SQL: [20260919000001_auth_security_hardening.sql](../supabase/migrations/20260919000001_auth_security_hardening.sql).

Migration bir transaction içinde:

1. `handle_new_auth_user` fonksiyonunu değiştirir. Yeni profil daima `company_id=NULL`, `role=NULL`, `role_approval_status='pending'` olur. Metadata’dan yalnız görünen ad ve doğrulanacak katılım talebi girdileri okunur; metadata rol/company_id/join_company_id/approval değerleri kullanılmaz.
2. Şirket adı ve kodunu DB’den doğrulayıp yalnız `pending` katılım talebi oluşturur. Bu işlem üyelik/onay vermez. Yanlış kod signup transaction’ını reddeder.
3. İstemcinin doğrudan profil INSERT/DELETE, şirket INSERT ve katılım talebi INSERT yetkilerini kaldırır. Yetkili katılım/onay RPC’leri kullanılmaya devam eder.
4. Profil rol/şirket helper’larını onaylı, tutarlı profillerle sınırlar. Self-update guard’ı profil kimliği değişimini ve başka kullanıcıya `superAdmin` verilmesini de engeller. SuperAdmin ataması yalnız güvenilir SQL/service-role profil güncellemesiyle yapılabilir.
5. `request_join_company` mevcut üyeyi başka şirkete taşımaz; yalnız üyeliği olmayan kullanıcı için talep oluşturur. `approve_join_request` onaylı CM, aynı şirket, izinli rol ve uygun hedef profil arar. Önceden şirkete bağlanmış rolsüz pending talepler ve `company_max_users` özel kota davranışı korunur.
6. `try_claim_pending_signup` daima false döndürür; PUBLIC/anon/authenticated/service_role çalıştırma izinleri kaldırılır.

Mevcut kullanıcı/şirket satırlarına toplu UPDATE/DELETE yapılmaz. Yeni fonksiyon gövdelerindeki INSERT/UPDATE yalnız ileride çağrıldıklarında çalışır. Eski migration dosyaları değiştirilmedi; sıralı migration zinciri kullanılmalıdır. Eski toplu `RUN_ALL_MIGRATIONS_ONE_GO.sql` bu düzeltmenin yerine geçmez.

## Test sonuçları

| Kontrol | Sonuç |
| --- | --- |
| `npm run build` | Başarılı; 12 public HTML, private shell ve 404 üretildi. Mevcut Vite statik/dinamik import uyarıları var; build hatası yok. |
| `npm run typecheck` | Başarılı. |
| `npm run test:seo` | 15/15 başarılı. |
| `npm run test:security` | 60/60 başarılı: 22 PostgreSQL testi, 38 istemci/API/guard/cache/bundle testi. |
| `git diff --check` | Başarılı. |

SQL testleri test-only `@electric-sql/pglite` ile bellek içindeki PostgreSQL üzerinde çalışır. İlgili mevcut auth/onboarding migration’ları ve yeni migration çalıştırılır; prod verisi/bağlantısı kullanılmaz. Dört rolün mevcut profil satırlarının değişmediği, RLS ile kendi profilini okuyabildiği, normal CM onayı ve özel kotanın korunduğu doğrulandı. Bu fixture tüm production şemasının veya Supabase Auth sunucusunun birebir kopyası değildir.

İstemci testlerinde gerçek TypeScript modülleri çalıştırılır, Auth/DB yanıtları taklit edilir. Metadata saldırıları, eksik profil, pending/rejected dört rol, hatalı kimlik/şirket, stale cache, logout/restore yarışı, geç gelen senkronizasyon, eksik Supabase config, mock endpoint’leri ve guard davranışları test edilir. Üretilen JS/source map’lerde ödeme secret referansı/header’ı ve base64 parola fallback’i yoktur. Gerçek kullanıcıyla tarayıcı login/session ve tüm operasyon ekranlarında E2E testi yapılmadı; bunların canlıda çalıştığı iddia edilmez.

Önceki audit kaynak hash’leriyle karşılaştırmada public ürün/SEO kaynakları, landing içeriği/tasarımı, sitemap, canonical/metadata, robots, Vercel host/noindex kuralları ve mevcut SEO testleri değişmedi. Yedi çözüm sayfası doğrudan açılışta uygulama JS’i/Supabase yüklemez. Günlük iş, işler, onaylar, hakediş, irsaliye, stok/zimmet, rapor ve yönetim/ayar ekranlarının kaynakları korunmuştur; route guard ve oturum/cache kontrolleri bilinçli güvenlik değişiklikleridir.

## Bu çalışmada değişen dosyalar

- Auth/oturum: `src/features/auth/services/authService.ts`, yeni `registrationDraft.ts`; `src/features/auth/pages/Login.tsx`, `Register.tsx`, `Workspace.tsx`; `src/app/providers/AppContext.tsx`, `src/app/router/AppRoutes.tsx`.
- Cache: `src/lib/storage/store.ts`, `paidSignupSession.ts`, `pendingNewCompanySignup.ts`; `src/lib/supabase/supabaseSyncService.ts`, `src/features/companies/services/companyService.ts`.
- Ödeme: `src/lib/api/paidSignupApi.ts`; `api/create-pending-signup.js`, `api/mock-payment-success.js`, `api/supabase-functions.js`; `api/lib/createPendingSignupServer.js`, `mockPaymentSuccessServer.js`, `activatePaidSignupNode.js`; `supabase/functions/create-pending-signup/index.ts`, `mock-payment-success/index.ts`, `_shared/activatePaidSignup.ts`.
- Yapılandırma/açıklamalar: `.env.example`, `src/vite-env.d.ts`, `supabase/functions/PAID_SIGNUP_EDGE.md`; `src/lib/i18n/locales/{tr,en,de,fr,es}.json` içinde yalnız iki auth/onboarding mesajı.
- Migration/testler: yeni SQL dosyası; yeni `scripts/security.test.mjs`, `scripts/security-db.test.mjs`; `package.json`, `package-lock.json`; bu rapor.

Önceden çalışma alanında bulunan SEO değişiklikleri bu listenin parçası değildir. Yerel `.env*` dosyalarında eski mock-secret tanımları varsa kaldırıldı; değerleri raporlanmadı. Production ortam değişkenleri okunmadı/değiştirilmedi.

## İnceleme ve yayın sınırı

Bu paket kaynak kod incelemesine hazırdır; production güvenliği sağlandı anlamına gelmez. Migration, web/API ve Edge değişiklikleri henüz production’da uygulanmadı. Sadece web deploy’u eski Edge endpoint’lerini kapatmaz. Onaylı bir sonraki aşamada staging üzerinde gerçek Supabase signup/email confirmation, dört rolün login/restore ve katılım onayı denenmeli; migration ve endpoint kapatmaları birlikte planlanmalıdır.

Eski açık üzerinden oluşturulmuş olabilecek ayrıcalıklı DB profilleri otomatik olarak tespit edilmiş veya temizlenmiş değildir. Mevcut superAdmin/CM kayıtlarının meşruiyeti güvenilir kayıtlarla ayrıca incelenmelidir; migration geçerli kullanıcıları korumak için bu satırları değiştirmez. Daha önce VITE_* ile yayımlanmış bir secret varsa yayın ortamında kaldırma/rotasyon ayrıca gerekir; burada hiçbir gerçek anahtar yayımlanmadı.

Karar: **SAFE FOR REVIEW**.
