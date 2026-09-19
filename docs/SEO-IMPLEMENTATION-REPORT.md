# MK OPS public ürün / SEO uygulama raporu

19 Eylül 2026. Çalışma yerel kaynak kodda tamamlandı; production deploy veya veritabanı işlemi yapılmadı.

## 1. Kaynaktan doğrulanan modüller

Günlük iş girişi ve işler, şirket/proje/ekip yönetimi, iş kalemi/araç/ekipman katalogları, irsaliye, merkez stok ve ekip zimmeti, iş onayları, hakediş dönemleri ve hesapları, Excel/PDF raporları, dashboard toplamları, denetim olayları, kullanıcı onayları, bildirimler ve şirket ayarları. Kanıtlar ve yetki ayrıntıları PRODUCT-CAPABILITY-MAP.md içindedir. Personel, puantaj, vardiya, GPS, fiber ek haritalama, e-İrsaliye veya muhasebe entegrasyonu ürün özelliği olarak eklenmedi.

## 2. Roller

companyManager, projectManager, teamLeader, superAdmin. Denetim Günlüğü ekranının CM sınırı ve ekip liderinin ekip/fiyat kapsamı içerikte gözetildi. Ekip üyelerinin bulunması bir İK modülü olarak yorumlanmadı.

## 3. Public / private yapı

`/` oturumsuz Landing ve oturumlu Dashboard davranışını korur. Mevcut beş route guard fonksiyonunun TypeScript AST üzerinden alınan gövdeleri git HEAD ile karşılaştırıldı; değişiklik yok. İş, rapor, yönetim, ayar ve admin URL'leri `app.html` üzerinden mevcut SPA'ya gider. API route'ları yeniden yazılmadı. Public render girişi AppProvider, auth servisleri veya store import etmez.

## 4–5. Oluşturulan sayfalar ve arama niyetleri

| URL | Birincil niyet |
| --- | --- |
| `/` (geliştirildi) | Saha operasyon yönetim sistemi; ürünün genel tanımı ve çözüm hub'ı |
| `/cozumler/telekom-saha-takibi` | Telekom/fiber projesi, ekip ve kablo malzemesi bağlamında saha takibi |
| `/cozumler/gunluk-is-takibi` | Günlük üretimin proje, miktar, not ve fotoğrafla kaydı |
| `/cozumler/saha-onay-surecleri` | Gönderilmiş işin yönetici incelemesi ve onay/ret akışı |
| `/cozumler/hakedis-takibi` | Onaylı üretimden iş değeri, ekip payı ve dönem hesabı |
| `/cozumler/irsaliye-malzeme-takibi` | Teslim alma, merkez stok, zimmet, iade ve transfer |
| `/cozumler/operasyon-raporlama` | Dönem/ekip seçimi ve Excel/PDF çıktı |
| `/cozumler/denetim-gunlugu` | Operasyon olaylarında aktör, tarih ve kayıt bağlamı |

Mevcut kılavuz, gizlilik, kullanım şartları ve geri ödeme sayfaları da başlangıç HTML'i ve özgün metadata ile render edilir; yasal içerikleri yeniden yazılmadı.

## 6. Değiştirilen dosyalar

`.gitignore`, `README.md`, `index.html`, `package.json`, `public/sitemap.xml`, `public/robots.txt`, `vercel.json`, `src/App.tsx`, `src/app/router/AppRoutes.tsx`, `src/features/landing/pages/Landing.tsx`, `Landing.module.css`, `src/lib/i18n/I18nContext.tsx`.

I18n değişikliği build renderer için opsiyonel başlangıç dili ve sunucu ortamı kontrolüdür; mevcut istemci locale saklama davranışı korunur. Başlangıçta çalışma alanında zaten değişmiş görünen `vite.config.js` ve `tsconfig.node.tsbuildinfo` ürün değişikliği kapsamına alınmadı; mevcut `tsc -b` build'i generated dosyaları yeniden üretir.

## 7. Eklenen dosyalar

`src/features/product/content.ts`, `ProductPages.tsx`, `ProductPages.module.css`, `RouteMetadata.tsx`, `prerender.tsx`; `scripts/prerender.mjs`, `scripts/seo.test.mjs`; `docs/PRODUCT-CAPABILITY-MAP.md`, bu rapor. `.prerender/` ve `dist/` build çıktılarıdır, commit kapsamı dışındadır.

## 8. Teknik SEO

Sayfaya özgü title, description, canonical, OG ve Twitter metadata başlangıç HTML'inde bulunur. SPA içi geçişlerde metadata güncellenir. H1, semantic main, navigasyon, detay/summary SSS ve klavye focus stilleri eklendi. Ana sayfadaki desteklenmeyen özellik kartları ve canlı etiketli kurgusal rakamlar kaldırıldı. Herkese açık müşteri ekran görüntüsü kullanılmadı.

## 9. Sitemap

12 indekslenebilir URL: ana sayfa + 7 çözüm + 4 mevcut bilgi/yasal sayfa. Login, register, pricing kopyası, private route ve API yok. lastmod kaldırıldı; build zamanı değişiklik tarihi olarak sunulmaz.

## 10. Robots / noindex

Public crawl açık. Private HTML başlangıçta `noindex, nofollow`; private/auth/API Vercel yanıtlarında ayrıca X-Robots-Tag tanımlı. Oturumlu ana sayfada istemci metadata'sı noindex olur ve ürün schema/canonical kaldırılır. Robots.txt kimlik doğrulama yerine kullanılmaz; crawler noindex yönergesini okuyabilsin diye private yollar Disallow ile kapatılmaz.

## 11. Canonical / host

Canonical ve paylaşım URL'leri `https://mk-ops.tr`. Canlı HEAD kontrolünde non-www HTTPS 200, www HTTPS 200, HTTP non-www 308 → HTTPS non-www gözlendi. Bu yüzden host koşullu www → non-www permanent redirect eklendi. `/pricing` mükerrer içeriği ana sayfa teklif bölümüne yönlendirilir. Yeni kurallar henüz production'da uygulanmadı; Vercel proje ayarlarının daha sonra ters host yönlendirmesi eklememesi gerekir.

## 12. Structured data

Ana sayfada WebSite ve WebApplication; çözümlerde görünür içerik yoluyla eşleşen BreadcrumbList. Sahte fiyat, teklif, rating, review veya kuruluş kimliği eklenmedi. SSS görünür HTML olarak bulunur; FAQ rich result vaadi ve FAQPage işaretlemesi eklenmedi. WebApplication semantik tanım sağlar; Google yazılım rich result uygunluğu iddia edilmez.

## 13. Internal linking

Ana sayfa yedi çözümü doğrudan bağlar. Her çözüm yalnız ilgili üç çözüme içerik ilişkisiyle bağlanır; breadcrumb ve footer'da geri dönüş/ürün bağlantıları vardır. CTA mevcut WhatsApp numarasından merkezi config ile üretilir; demo adresi de mevcut kaynaktan taşındı. Mesaj gönderilmedi.

## 14. Performans ve erişilebilirlik

Yedi çözümün doğrudan açılışında uygulama JS'i, Supabase veya animasyon runtime'ı yüklenmez; yalnız statik HTML ve CSS. Bu sayfalarda gereksiz Google Font bağlantıları çıkarıldı. Ana sayfada hero preload, logo boyutları ve footer logo lazy-loading eklendi. Prerender içeriğinin opacity:0 ile gizlenmesi engellendi. Yeni sayfalar 760px altında tek kolona geçer; ana sayfa navbar'ı dar ekranda sarılır. Reduced-motion/focus ve skip link düzenlemeleri yapıldı. CSS sınıflarının üretilen HTML ile eşleşmesi test edilir.

LCP, CLS ve INP için gerçek tarayıcı/alan ölçümü yapılmadı; sayısal performans artışı iddia edilmez. Mevcut ana sayfa oturum davranışı için SPA ve Framer Motion yüklemeye devam eder.

## 15. Güvenlik

Yeni render yolunda özel veri erişimi yok; public içerik yalnız statik açıklamalardır. Auth, RLS, Supabase client/service-role sınırları veya API davranışları değiştirilmedi. Kaynak incelemesinde mevcut base64 parola fallback'i, metadata'dan profil/rol kurtarma ve istemciye açılabilen VITE_MOCK_PAYMENT_SECRET / mock ödeme kontrolü ayrıca raporlandı. Bunlar ayrı güvenlik incelemesi gerektirir; canlı ortamda istismar veya yetki yükseltme testi yapılmadı. Ayrıntı: PRODUCT-CAPABILITY-MAP.md.

## 16. Kontroller ve sınırlar

- Production build ve TypeScript kontrolü başarılı.
- 15 SEO testi başarılı: public HTML, tek H1, metadata, canonical, schema JSON, CSS dosyası/sınıf eşleşmesi, sitemap, internal linkler, private shell/noindex, host yönü ve 404 çıktısı.
- `git diff --check` başarılı.
- `npm run lint` ve `npm test` denendi; repository'de bu script'ler tanımlı değil. Yerine sonuç uydurulmadı veya gereksiz bağımlılık eklenmedi.
- Beş auth route guard fonksiyonu baseline ile aynı. DB migration ve servis değişikliği yok.
- Bağlı otomasyon tarayıcısı bulunamadı. 360px/desktop görsel test, gerçek login/session E2E, klavye etkileşim testi ve Core Web Vitals ölçümü yapılamadı. CSS/HTML kontrolleri görsel testin yerine geçtiği iddia edilmez.
- Vercel header/redirect/404 kuralları kaynak ve build seviyesinde denetlendi; deploy sonrası HTTP kontrolü gerekli. Vite preview bu platform kurallarını taklit etmez.

## 17. Bilerek değiştirilmemiş kritik alanlar

Auth ve session servisleri, AppProvider, kullanıcı rolleri/izinleri, database tabloları ve RLS, migration'lar, server API/Edge Functions, iş/hakediş/stok/onay hesapları ve panel ekranları korunmuştur. CMS, yeni dependency, sahte referans/fiyat veya programmatic şehir sayfası eklenmedi.

## Teknik kaynaklar

- Başlangıç HTML'i ve noindex davranışı: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- Schema değerlendirmesi: [Google software application](https://developers.google.com/search/docs/appearance/structured-data/software-app).
- Hosting kuralları: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [statik 404](https://vercel.com/kb/guide/custom-404-page).
