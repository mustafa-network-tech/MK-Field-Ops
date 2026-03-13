# MK-OPS System Documentation

Bu dokümantasyon MK-OPS panelinin çalışma mantığını, mimarisini ve tüm modüllerini açıklar. Teknik bir sistem dokümantasyonudur; kod örnekleri içermez.

---

## 1. Platform Overview

**MK-OPS**, şirketlerin saha ve operasyon süreçlerini dijital ortamda yönetmelerini sağlayan çok kiracılı (multi-tenant) bir SaaS platformudur. Her şirket kendi verilerine yalnızca kendi yetkili kullanıcıları ile erişir.

**Temel mantık:**
- Kullanıcılar şirkete katılım talebi oluşturur; şirket yöneticisi bu talepleri onaylayarak kullanıcıları proje müdürü veya ekip lideri rolleriyle sisteme dahil eder.
- Kampanyalar altında projeler tanımlanır; projeler ekiplere atanır.
- Ekip liderleri günlük iş girişleri (iş kaydı) yapar; şirket yöneticisi veya proje müdürü bu kayıtları onaylar.
- Depoya irsaliye ile malzeme girişi yapılır; malzemeler ekiplere zimmetlenir. Onaylanan iş kayıtlarında kullanılan malzemeler zimmetten düşülür.
- İş tutarları ve hakedişler rol bazlı görünürlük kurallarına göre hesaplanır ve raporlanır.

---

## 2. System Architecture

### 2.1 Frontend Yapısı

- **Teknoloji:** React, TypeScript, React Router, CSS Modules.
- **Klasör yapısı:**
  - **pages:** Tüm sayfa bileşenleri (Landing, Login, Register, Workspace, Dashboard, JobEntry, MyJobs, Management, TeamDetail, Approvals, Reports, DeliveryNotes, Settings, PayrollPeriods, AuditLogs; ayrıca Gizlilik, Kullanım Şartları, Geri Ödeme, Kullanım Kılavuzu).
  - **components:** Layout (sidebar + TopBar), yönetim paneli alt bileşenleri (TeamsTab, ProjectsTab, UsersTab, MaterialsTab, WorkItemsTab, EquipmentTab, VehiclesTab, AuditLogTab).
  - **context:** AppContext (giriş yapan kullanıcı, şirket bilgisi, store’dan veri besleme).
  - **i18n:** Çok dilli metinler (TR, EN, DE, ES, FR); locale company diline veya kullanıcı seçimine göre ayarlanır.

- **Rota yapısı:** Giriş yapmamış kullanıcı ana sayfada Landing görür; giriş yapınca Layout içinde Dashboard, İş Girişi, İşlerim, Yönetim Paneli, İrsaliyeler, Onaylar, Raporlar, Ayarlar, Hakediş Dönemleri, Denetim Kayıtları sayfalarına erişir. Rol bazlı olarak İrsaliyeler, Ayarlar, Hakediş Dönemleri ve Denetim Kayıtları yalnızca şirket yöneticisi ve proje müdürüne açılır.

### 2.2 Backend Yapısı

- **Auth ve profil:** Supabase Auth (e-posta/şifre ile giriş, kayıt, şifre sıfırlama). Profil bilgileri (rol, onay durumu, şirket) Supabase `profiles` tablosunda tutulur.
- **Uygulama mantığı:** İş kuralları ve veri erişimi `src/services` altındaki servislerde toplanmıştır: authService, companyService, teamService, jobService, materialStockService, payrollPeriodService, payrollReportService, auditLogService vb. Bu servisler hem yetki kontrolü hem de hesaplama (iş tutarı, hakediş) yapar.
- **Veri katmanı:** Merkezi veri kaynağı `src/data/store.ts` dosyasındaki store’dur. Store, bellek ve isteğe bağlı olarak tarayıcı localStorage ile senkron çalışır. Supabase kullanıldığında auth ve profil Supabase üzerinden; şirket oluşturma/katılım da Supabase ile yapılır. Diğer varlıklar (kampanya, proje, ekip, iş kaydı, malzeme, irsaliye vb.) şu an store üzerinden yönetilir; ileride bu verilerin Supabase tablolarına taşınması mümkündür.

### 2.3 Veritabanı Yapısı

Supabase tarafında (migrations / schema) kullanılan ana kavramlar:

- **companies:** Şirket bilgisi (ad, dil, logo, hakediş dönemi ayarı vb.).
- **profiles:** Kullanıcı profili (şirket, rol, ad soyad, rol onay durumu, e-posta; can_see_prices gibi alanlar).
- **campaigns:** Kampanyalar (şirket, ad).
- **projects:** Projeler (şirket, kampanya, yıl, harici proje kodu, alınış tarihi, ad, açıklama, durum: aktif/tamamlandı/arşiv).
- **teams:** Ekipler (şirket, kod, açıklama, yüzde, lider, üyeler, onay durumu, araç).
- **work_items:** İş kalemleri (birim fiyat, kod).
- **jobs:** İş kayıtları (tarih, proje, ekip, iş kalemi, miktar, malzeme kullanımları, durum: taslak/gönderildi/onaylandı/reddedildi).
- **material_stock:** Malzeme stok kayıtları (tip, miktar, birim, kablo için makara vb.).
- **team_material_allocations:** Ekip zimmetleri (ekip, stok kalemi, miktar).
- **delivery_notes / delivery_note_items:** İrsaliye başlık ve satırları.
- **material_audit_log:** Malzeme hareketleri denetim kaydı.
- **payroll_period_settings:** Şirket bazlı hakediş dönemi ayarı (ayın kaçında dönem başlar).
- **audit_logs:** Genel sistem denetim kayıtları.

Store tarafında aynı kavramlar `tf_*` anahtarları ile localStorage’da saklanabilir (ör. tf_companies, tf_projects, tf_jobs).

### 2.4 Kullanılan Teknolojiler

- **Frontend:** React 18, TypeScript, React Router 6, CSS Modules.
- **Auth ve backend altyapı:** Supabase (Auth, PostgreSQL tabloları).
- **Raporlama:** PDF için jsPDF ve jspdf-autotable; Excel için xlsx kütüphanesi.
- **Uluslararasılaştırma:** Kendi i18n context’i ve JSON locale dosyaları.

---

## 3. User Roles

Sistemde üç rol vardır: **şirket yöneticisi**, **proje müdürü**, **ekip lideri**. Roller `profiles` ve store’daki kullanıcı kaydında tutulur.

### 3.1 Şirket Yöneticisi (companyManager)

- Şirketi oluşturan ilk kullanıcı otomatik olarak şirket yöneticisi atanır; tektir.
- Tüm şirket verilerine erişir; şirket ayarlarını (ad, dil, logo, hakediş dönemi) değiştirebilir.
- Yeni kullanıcıların katılım taleplerini onaylar veya reddeder; onaylarken rol atar (proje müdürü veya ekip lideri).
- Ekip liderlerine “fiyat görme” yetkisi (can_see_prices) verebilir.
- Kampanya, proje, ekip, iş kalemi, malzeme, ekipman, araç tanımlarını yönetir; irsaliye girişi yapar; stoktan ekiplere zimmet dağıtır.
- İş kayıtlarını onaylar veya reddeder.
- Hakediş dönemleri ve raporları görür; şirket ve ekip bazında PDF/Excel dışa aktarır.
- İrsaliyeler, Ayarlar, Hakediş Dönemleri ve Denetim Kayıtları sayfalarına erişir.

### 3.2 Proje Müdürü (projectManager)

- Şirket yöneticisine benzer yetkilerle çalışır; ancak şirket bilgilerini (ad, dil, logo vb.) değiştiremez.
- Kullanıcı onaylama, rol atama, kampanya/proje/ekip/malzeme/iş kalemi yönetimi, irsaliye, zimmet, iş onayı, hakediş ve raporlara erişir.
- İrsaliyeler, Ayarlar, Hakediş Dönemleri ve Denetim Kayıtları sayfalarına erişir.

### 3.3 Ekip Lideri (teamLeader)

- Yalnızca kendisinin lideri olduğu ekiplerle sınırlıdır; bir kullanıcı yalnızca bir ekipte lider olabilir.
- İş girişi sayfasında sadece kendi ekiplerini seçebilir; iş kaydı oluşturup gönderebilir.
- İşlerim ve Ekip Detay sayfalarında yalnızca kendi ekiplerinin işlerini ve özetlerini görür.
- Fiyat görünürlüğü: Şirket yöneticisi veya proje müdürü “fiyat görme” yetkisi vermedikçe birim fiyat, toplam tutar ve ekip hakedişi görünmez; yetki verildiğinde kendi ekip kazançlarını görebilir. Şirket payı veya toplam iş tutarı ekip liderine hiç gösterilmez.
- Malzeme stokuna ekleme/çıkarma veya ekiplere zimmet dağıtma yapamaz; sadece kendi ekip zimmetinden iş girişinde malzeme kullanımı seçebilir.
- Raporlar sayfasında yalnızca kendi ekibine ait raporu dışa aktarabilir.
- İrsaliyeler, Ayarlar, Hakediş Dönemleri ve Denetim Kayıtları menü öğeleri ekip liderine gösterilmez.

---

## 4. Company Structure

### 4.1 Şirket Oluşturma

- Kayıt akışında kullanıcı e-posta, şifre ve ad soyad girer; “yeni şirket” seçeneği ile şirket adını belirtir.
- Workspace / kayıt sonrası akışta “yeni şirket” ile `authService.registerNewCompany` çağrılır: Supabase kullanılıyorsa önce `companies` tablosuna şirket eklenir, ardından Auth signUp ile kullanıcı oluşturulur ve profile’da company_id, rol companyManager ve role_approval_status approved atanır. Supabase yoksa store’a şirket ve kullanıcı eklenir.
- Bu kullanıcı artık şirket yöneticisidir; panele giriş yaparak tüm yönetim işlemlerini yapabilir.

### 4.2 Şirket Katılım Sistemi

- Başka bir kullanıcı “mevcut şirkete katıl” seçeneği ile şirket ID’si (veya adı) girerek kayıt olur.
- `authService.registerExistingCompany` ile Supabase’de ilgili şirket bulunur, signUp ile kullanıcı oluşturulur; profile’da company_id atanır ancak role_approval_status “pending” olur, rol atanmaz.
- Kullanıcı giriş yapmaya çalıştığında onay durumu “approved” değilse panele alınmaz; “şirket yöneticisi onayı bekleniyor” benzeri bir mesaj gösterilir.

### 4.3 Kullanıcı Onay Sistemi

- Yönetim paneli > Kullanıcılar sekmesinde şirket yöneticisi (ve proje müdürü) bekleyen kullanıcıları görür.
- Her bekleyen kullanıcı için rol seçilir (proje müdürü veya ekip lideri) ve “onayla” veya “reddet” işlemi yapılır.
- Onaylama: `authService.approveUser(userId, assignedRole)` ile profile’da role ve role_approval_status güncellenir; kullanıcı bir sonraki girişte panele erişir.
- Red: `rejectUser(userId)` ile onay durumu reddedildi olarak işaretlenir; kullanıcı panele alınmaz.

---

## 5. Campaign System

- **Kampanya:** Projeleri gruplamak için kullanılan üst kavramdır (ör. yıl veya müşteri bazlı gruplar).
- **Oluşturma:** Yönetim paneli > Projeler sekmesinde kampanya listesi yönetilir; gerekirse yeni kampanya eklenir (ad ve şirket). Store’da `tf_campaigns`; Supabase’de `campaigns` tablosu.
- **Projelerin kampanyalara bağlanması:** Her proje oluşturulurken bir kampanya seçilir; proje kaydında `campaignId` alanı ile kampanyaya bağlanır. Proje listesi ve filtreleme kampanya bazında yapılabilir.

---

## 6. Project System

### 6.1 Proje Oluşturma

- Yönetim paneli > Projeler sekmesinde “proje ekle” ile yeni proje oluşturulur.
- Zorunlu alanlar: kampanya, proje yılı, harici proje kodu (kurumdan gelen proje numarası vb.), alınış tarihi. İsteğe bağlı: proje adı, açıklama.
- Aynı şirket + kampanya + yıl + harici proje kodu kombinasyonu tekrarlanamaz (benzersiz proje anahtarı).
- Proje oluşturulduğunda durum “ACTIVE” olur; şirket yöneticisi veya proje müdürü projeyi “tamamlandı” işaretleyebilir (onay bekleyen iş kaydı yoksa). Tamamlanan projeler “COMPLETED” veya “ARCHIVED” durumunda tutulabilir.

### 6.2 Projelerin Kampanyaya Bağlı Olması

- Her proje tek bir kampanyaya aittir (`project.campaignId`). Kampanya silinmez; proje listesi kampanya bazında filtrelenebilir veya gruplanabilir.

### 6.3 Projelerin Ekiplerle İlişkilendirilmesi

- Proje ile ekip doğrudan bir tabloda eşleştirilmez; ilişki **iş kaydı** üzerinden kurulur. Her iş kaydında proje ve ekip seçilir; böylece hangi ekip hangi projede ne kadar iş yaptığı iş kayıtlarından hesaplanır. Ekip detay ve raporlarda proje bazlı iş ve kazanç özetleri bu kayıtlardan türetilir.

---

## 7. Work Entry System

### 7.1 Günlük İş Girişleri

- **Sayfa:** İş Girişi (Job Entry). Tarih, kampanya → proje, ekip, iş kalemi, miktar girilir. İsteğe bağlı: malzeme kullanımları (ekip zimmetinden veya serbest), ekipman, not.
- **Kim girer:** Ekip lideri yalnızca kendi lideri olduğu ekipleri seçebilir; şirket yöneticisi ve proje müdürü tüm ekipler için giriş yapabilir.
- Kayıt önce “taslak” veya doğrudan “gönderildi” olarak saklanır; gönderilen kayıt onay kuyruğuna düşer.

### 7.2 Ekip Liderlerinin İş Girmesi

- Ekip lideri giriş yapınca `teamScopeService.getTeamsForJobEntry` ile yalnızca `leaderId === user.id` olan ekipler listelenir. Proje ve iş kalemi şirket kapsamındaki listelerden seçilir.

### 7.3 Yönetici Onayı

- Onaylar sayfasında durumu “submitted” olan iş kayıtları listelenir. Yalnızca şirket yöneticisi ve proje müdürü onay/red işlemi yapabilir.
- Onay: İş kaydında kullanılan malzemeler ekip zimmetine bağlıysa (`teamZimmetId`), onay anında bu zimmetten düşüm yapılır. Yetersiz zimmet varsa onay işlemi hata verir; kullanıcıya “yetersiz zimmet” mesajı gösterilir. Başarılı onayda iş kaydı “approved” olur, zimmet düşümü tamamlanır ve stok/denetim kaydı güncellenir.
- Red: İş kaydı “rejected” olarak işaretlenir; zimmet düşülmez.

---

## 8. Team Management

### 8.1 Ekip Oluşturma

- Yönetim paneli > Ekipler sekmesinde yeni ekip eklenir. Alanlar: kod, açıklama, yüzde (ekip kazanç payı), lider (onaylı ekip lideri rolündeki kullanıcılardan seçilir), üye kullanıcılar, manuel üye listesi (ad, telefon, rol), isteğe bağlı araç.
- Bir kullanıcı en fazla bir ekipte lider olabilir; `teamService.addTeam` bu kuralı kontrol eder. Ekip oluşturulduğunda onay durumu “pending” veya “approved” olabilir; şirket yöneticisi/proje müdürü ekip onayını güncelleyebilir.

### 8.2 Ekip Liderleri

- Ekip lideri rolü atanmış ve onaylanmış kullanıcılar, ekip oluşturulurken “lider” olarak atanabilir. Lider atanan ekip, iş girişi ve raporlarda o liderin kapsamına girer.

### 8.3 Ekip Yapısı

- Ekip: şirkete ait; kod ve yüzde ile tanımlı; lider ve üye listesi (sistem kullanıcıları + manuel girişler); isteğe bağlı araç. Ekip, iş kayıtları ve zimmet dağılımında referans alınan birimdir.

---

## 9. Material Management

### 9.1 Malzeme Stok Sistemi

- Stok kalemleri `MaterialStockItem` tipinde; ana tip (direk, kablo_ic, kablo_yeraltı, boru, menhol, özel vb.) ve isteğe bağlı alt kategorilerle tanımlanır. Kablo türleri için metre/makara bilgisi tutulabilir.
- Stok listesi Yönetim paneli > Malzemeler sekmesinde görülür; stok ekleme, güncelleme ve silme yalnızca şirket yöneticisi ve proje müdürü tarafından yapılır.

### 9.2 Depo Sistemi

- Merkezi depo kavramı, malzeme stok kayıtları ve irsaliye girişleri ile modellenir. İrsaliye ile gelen malzemeler stok tablosuna eklenir; ekiplere dağıtım (zimmet) bu stoktan yapılır.

### 9.3 Malzeme Takibi

- Stok hareketleri (ekleme, ekipe dağıtım, iade, ekipler arası transfer) `material_audit_log` / `tf_material_audit_log` ile kayıt altına alınır. İş onayında zimmetten düşüm de denetim kaydına yansıyabilir.

---

## 10. Delivery Note System

- **Amaç:** Depoya giren malzemelerin irsaliye belgesi ile kaydedilmesi.
- **Sayfa:** İrsaliyeler (Delivery Notes). Yalnızca şirket yöneticisi ve proje müdürü erişir.
- **Veri yapısı:** İrsaliye başlığı (tedarikçi, alınış tarihi, irsaliye numarası, teslim alan kullanıcı); satırlar (stok kalemi, miktar, birim).
- **Akış:** İrsaliye kaydı oluşturulur ve satırlar eklenir. Kayıt onaylandığında veya gönderildiğinde ilgili stok kalemlerinin miktarları artırılır; istenirse aynı akışta ekip zimmetine de dağıtım yapılabilir (uygulama detayına göre). Veriler `delivery_notes` ve `delivery_note_items` (veya store karşılıkları) ile saklanır.

---

## 11. Material Assignment (Zimmet)

### 11.1 Malzeme Zimmet Sistemi

- Stoktaki malzemeler ekiplere “zimmet” olarak dağıtılır. Dağıtım Yönetim paneli veya malzeme/irsaliye akışı üzerinden yapılır; sadece şirket yöneticisi ve proje müdürü zimmet dağıtabilir, iade veya ekipler arası transfer yapabilir.
- Her zimmet kaydı: ekip, stok kalemi, miktar (adet veya metre). Veri `team_material_allocations` / `tf_team_material_allocations` içinde tutulur.

### 11.2 Ekip Zimmet Listesi

- Ekip bazında zimmet listesi, malzeme yönetimi ekranlarında ve iş girişinde “malzeme kullanımı” seçerken gösterilir. Ekip lideri iş girişinde yalnızca kendi ekip zimmetindeki kalemleri kullanım olarak seçebilir; onay sonrası bu zimmetten düşüm otomatik yapılır.

---

## 12. Work Cost System

### 12.1 İş Tutarları

- Her iş kalemi (work item) birim fiyat içerir. İş kaydında miktar × birim fiyat = toplam iş tutarı hesaplanır. Ekip yüzdesi ile ekip kazancı; kalan kısım şirket payı olarak hesaplanır. Hesaplama `jobCalculationService.computeJobFinancials` benzeri bir servis ile yapılır; sadece “onaylı” iş kayıtları hakediş ve raporlara dahil edilir.

### 12.2 Yetkilere Göre Görünürlük

- **Şirket yöneticisi / Proje müdürü:** Birim fiyat, toplam tutar, ekip kazancı, şirket payı ve tüm raporları görür.
- **Ekip lideri:** Varsayılan olarak birim fiyat ve tutarlar gizlidir. “Fiyat görme” yetkisi verilmişse kendi ekiplerinin kazançlarını ve ilgili birim fiyatları görebilir; şirket payı veya toplam iş tutarı gösterilmez. Bu kurallar `priceRules` ve dashboard/team detail/reports servislerinde uygulanır.

---

## 13. Earnings System (Hakediş)

### 13.1 Hakediş Sistemi

- Hakediş, onaylanmış iş kayıtlarının dönem bazında toplanması ve ekip/şirket paylarının hesaplanmasıdır. Şirket bazında “hakediş dönemi” ayarı vardır (ör. ayın 20’si – ertesi ayın 19’u). Bu dönemler `periodUtils` ile hesaplanır; `payrollPeriodService` ve `payrollReportService` dönem listesini ve dönem bazlı özetleri üretir.

### 13.2 Hakediş Dönemleri

- Ayarlar sayfasında (şirket yöneticisi/proje müdürü) dönem başlangıç günü (ör. 20) kaydedilir. Hakediş Dönemleri sayfasında dönem listesi ve her dönem için şirket toplamı ile ekip bazlı kırılım gösterilir. Ekip lideri bu sayfaya erişemez; kendi ekibinin özetini İşlerim veya Ekip Detay üzerinden (yetkisi varsa fiyatlarla) görebilir.

---

## 14. Reporting System

### 14.1 PDF Rapor

- Raporlar sayfasından hakediş raporu “PDF” olarak dışa aktarılır. Rapor, seçilen dönem ve kapsam (şirket veya tek ekip) için onaylanmış iş kayıtlarını listeler; proje, ekip, iş kalemi, miktar, birim fiyat, satır tutarı gibi sütunlar içerir. Şirket logosu isteğe bağlı filigran olarak eklenebilir. jsPDF ve jspdf-autotable kullanılır.

### 14.2 Excel Rapor

- Aynı hakediş verisi “Excel” formatında da dışa aktarılır (xlsx). Ek olarak “iş listesi” ve “dashboard özeti” için ayrı Excel dışa aktarma seçenekleri bulunabilir; bunlar ilgili sayfalardan (İşlerim, Dashboard vb.) tetiklenir. Fiyat görünürlüğü rol ve can_see_prices ayarına göre Excel çıktısına da yansır.

---

## 15. Security Model

### 15.1 Rol Bazlı Erişim

- Her sayfa ve veri seti kullanıcının rolüne göre filtrelenir: ekip lideri için ekip kapsamı `teamScopeService.getTeamsForUser` / `getTeamIdsForUser` ile sadece lideri olduğu ekiplerle sınırlanır. Menü öğeleri (İrsaliyeler, Ayarlar, Hakediş Dönemleri, Denetim Kayıtları) yalnızca şirket yöneticisi ve proje müdürüne gösterilir. İş onayı, kullanıcı onayı, malzeme stok ve zimmet işlemleri de rol kontrolü ile kısıtlanır.

### 15.2 Yetkilendirme Sistemi

- Giriş: Sadece `role_approval_status === 'approved'` olan kullanıcılar panele alınır.
- Şirket verisi: Tüm sorgular `companyId` ile filtrelenir; kullanıcı yalnızca kendi şirketinin verilerini görür.
- Fiyat görme: Ekip lideri için ayrıca `can_see_prices` bayrağı şirket yöneticisi/proje müdürü tarafından ayarlanır; bu bayrak dashboard, ekip detay ve raporlardaki tutar görünürlüğünü belirler.

---

## 16. Data Flow

Sistemdeki veri akışı özetle şu şekildedir:

1. **Kampanya → Proje:** Kampanyalar oluşturulur; projeler bir kampanyaya bağlanarak tanımlanır.
2. **Proje + Ekip:** Ekipler oluşturulur ve lider atanır. Proje–ekip ilişkisi doğrudan değil, iş kaydı üzerinden kurulur.
3. **İş Kaydı:** Ekip lideri (veya yönetici) tarih, proje, ekip, iş kalemi, miktar ve isteğe bağlı malzeme kullanımı girerek iş kaydı oluşturur ve gönderir.
4. **Onay:** Şirket yöneticisi veya proje müdürü gönderilen iş kayıtlarını onaylar veya reddeder. Onayda, zimmete bağlı malzeme kullanımları ekip zimmetinden düşülür.
5. **Hakediş:** Onaylanan iş kayıtları, şirketin hakediş dönemi ayarına göre dönemlere toplanır; ekip kazancı ve şirket payı hesaplanır.
6. **Rapor:** Hakediş dönemi ve kapsam (şirket veya ekip) seçilerek PDF veya Excel raporu üretilir; veri akışı: Kampanya → Proje → İş Kaydı → Onay → Hakediş → Rapor.

---

*Bu dokümantasyon MK-OPS panelinin mevcut davranışını ve modül yapısını özetler. Güncel kod ve veri şeması için ilgili kaynak dosyalara bakılmalıdır.*
