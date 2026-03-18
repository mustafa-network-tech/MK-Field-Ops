# MKfieldOPS Kullanım Kılavuzu

<!-- Arama: Bu kılavuzda arama alanı ile "giriş", "üye kaydı", "katılım kodu", "şirket", "onay" vb. anahtar kelimelere göre ilgili bölümlere hızlı erişim sağlanacaktır. -->

---

## Giriş ve Üyelik Kuralları

Bu bölüm, MKfieldOPS uygulamasına giriş yapma ve yeni kullanıcı kaydı oluşturma süreçlerini ve bu süreçlerde geçerli olan tüm kuralları açıklamaktadır.

### 1. Giriş Yapma (Login)

Kullanıcılar sisteme giriş yapmak için e-posta adresi ve şifre bilgilerini kullanırlar.

#### 1.1 Giriş Formu Alanları

| Alan    | Zorunluluk | Açıklama |
|---------|------------|----------|
| E-posta | Zorunlu    | Geçerli bir e-posta formatında olmalıdır. |
| Şifre   | Zorunlu    | Boş bırakılamaz. |

#### 1.2 Giriş Kuralları

Giriş işlemi sırasında aşağıdaki kontroller yapılır:

- Girilen e-posta ve şifre doğrulanır.
- Bilgiler eşleşmezse kullanıcıya şu hata gösterilir: **Geçersiz e-posta veya şifre.**
- Kullanıcının rol onayı yapılmış olmalıdır. Onaylanmamış kullanıcılar giriş yapamaz.
- Bu durumda kullanıcıya şu mesaj gösterilir: **Hesabınız oluşturuldu ancak henüz onaylanmadı. Şirket yöneticisi sizi onaylayana kadar giriş yapamazsınız.**

#### 1.3 Giriş Sonrası Yönlendirme

Giriş başarılı olduğunda sistem kullanıcıyı şu şekilde yönlendirir:

| Kullanıcı durumu              | Yönlendirme           |
|------------------------------|------------------------|
| Şirkete bağlı kullanıcı      | Ana sayfa             |
| Şirket katılımı bekleyen kullanıcı | Katılım bekleme sayfası |

#### 1.4 Şifremi Unuttum

Şifresini unutan kullanıcılar **Şifremi Unuttum** sayfasını kullanabilir.

- Sistem kullanıcının e-posta adresine şifre sıfırlama bağlantısı gönderir.
- Eğer şifre sıfırlama sistemi aktif değilse kullanıcıya şu mesaj gösterilir: **Şifre sıfırlama bu ortamda etkin değil.**

---

### 2. Üyelik Oluşturma (Register)

MKfieldOPS’ta kullanıcı kaydı iki aşamada tamamlanır.

- **Aşama 1:** Kullanıcı bilgileri girilir.
- **Aşama 2:** Kullanıcı **yeni bir şirket oluşturur** veya **mevcut bir şirkete katılır.**

---

### 3. Kayıt Adımı 1 – Kullanıcı Bilgileri

Bu aşamada kullanıcının temel bilgileri alınır.

#### Form Alanları

| Alan    | Zorunluluk | Açıklama |
|---------|------------|----------|
| Ad      | Zorunlu    | Boş bırakılamaz. |
| Soyad   | Zorunlu    | Boş bırakılamaz. |
| E-posta | Zorunlu    | Geçerli e-posta formatında olmalıdır. |
| Şifre   | Zorunlu    | Boş bırakılamaz. |

#### Kurallar

- Ad ve soyad alanları boş bırakılamaz.
- E-posta adresi geçerli formatta olmalıdır.
- Şifre alanı boş olamaz.
- Bu aşamada bilgiler henüz veritabanına kaydedilmez; bilgiler bir sonraki adım olan **Workspace (Şirket Ayarı)** ekranına aktarılır.

---

### 4. Yeni Şirket Oluşturma

Kullanıcı yeni bir şirket oluşturmak isterse aşağıdaki bilgiler girilir.

#### Form Alanları

| Alan           | Zorunluluk | Açıklama |
|----------------|------------|----------|
| Şirket Adı     | Zorunlu    | Boş bırakılamaz. |
| Katılım Kodu   | Zorunlu    | 4 rakamdan oluşmalıdır. |
| Plan           | Zorunlu    | Starter / Professional / Enterprise. |
| Fatura Dönemi  | Opsiyonel  | Aylık veya Yıllık. |

#### Katılım Kodu Kuralı

- Katılım kodu **tam 4 rakam** olmalıdır ve sadece sayısal değer içerir (örnek: 1234).
- Hatalı kod girilirse kullanıcıya şu mesaj gösterilir: **Katılım kodu tam 4 rakam olmalıdır.**

#### Şirket Adı Kuralları

- Aynı isimde ikinci bir şirket oluşturulamaz. Sistem şirket isimlerini normalize ederek kontrol eder.
- Bu durumda kullanıcıya şu mesaj gösterilir: **Bu şirket adı zaten kullanılıyor.**

#### Başarılı Şirket Oluşturma

Şirket başarıyla oluşturulduğunda:

- Kullanıcı **Company Manager** olarak atanır ve rolü **onaylı** olarak belirlenir.
- Seçilen plana göre sistem hazırlanır.
- **Starter plan** seçildiğinde **varsayılan bir kampanya** ve **varsayılan bir proje** otomatik oluşturulur.
- Ardından kullanıcı **Plan ve Ödeme** sayfasına yönlendirilir.

---

### 5. Mevcut Şirkete Katılma

Kullanıcı mevcut bir şirkete katılmak isterse aşağıdaki bilgileri girmelidir.

#### Form Alanları

| Alan           | Zorunluluk | Açıklama |
|----------------|------------|----------|
| Şirket Adı     | Zorunlu    | Boş bırakılamaz. |
| Katılım Kodu   | Zorunlu    | 4 rakam. |

#### Kurallar

- Girilen şirket adı ve katılım kodu eşleşmelidir.
- Sistem eşleşme bulamazsa kullanıcıya şu mesaj gösterilir: **Bu şirket bulunamadı.**

#### Kullanıcı Limiti Kontrolü

- Şirket planına göre kullanıcı sayısı sınırlıdır.
- Limit doluysa kullanıcıya şu mesaj gösterilir: **Kullanıcı limiti doldu. Plan yükseltmek için şirket yöneticinizle iletişime geçin.**

#### Katılım Sonrası Süreç

- Mevcut şirkete katılan kullanıcılar **onay bekleyen** kullanıcı olarak oluşturulur; şirket yöneticisi onay verene kadar giriş yapamaz.
- Kullanıcıya şu mesaj gösterilir: **Hesabınız oluşturuldu. Şirket yöneticisi sizi onaylayana kadar giriş yapamazsınız.**
- Daha sonra kullanıcı giriş sayfasına yönlendirilir.

---

### 6. Sistem Kurallarının Özeti

| Konu                    | Kural |
|-------------------------|--------|
| Giriş                   | Onaylı kullanıcılar giriş yapabilir. |
| E-posta                 | Her kullanıcı için benzersiz olmalıdır. |
| Şirket adı              | Aynı isimde ikinci şirket oluşturulamaz. |
| Katılım kodu            | 4 rakam olmalıdır. |
| Yeni şirket             | Kullanıcı Company Manager olur. |
| Mevcut şirkete katılım  | Yönetici onayı gerekir. |
| Kullanıcı limiti        | Plan limitine göre kontrol edilir. |

---

### 7. Teknik Notlar

- Katılım kodu her zaman 4 haneli sayıdır.
- Şirket isimleri karşılaştırılırken Türkçe karakterler normalize edilir.
- Bir şirkette sadece bir Company Manager olabilir.
- Starter plan oluşturulduğunda sistem otomatik olarak bir kampanya ve bir proje oluşturur.

---

## Ayarlar (Settings)

Bu bölüm paneldeki **Ayarlar** sayfasında şirket bilgilerinin ve şirket logosunun nasıl yönetildiğini açıklar.

### Şirket bilgileri ve logo

| Alan / İşlem | Zorunluluk | Açıklama |
|--------------|------------|----------|
| Şirket adı   | Zorunlu    | Şirketin görünen adı. Sadece **Company Manager** düzenleyebilir. |
| Şirket logosu| Opsiyonel  | Panelde (ör. sidebar, ayarlar) görünen şirket logosu. Yükleme veya kaldırma yalnızca **Company Manager** tarafından yapılabilir. |

#### Logo kuralları

- Logo dosyası Supabase Storage’da **company-logos** bucket’ına yüklenir.
- Kaydedildiğinde logo adresi hem yerel olarak gösterilir hem de veritabanında **`companies.logo_url`** alanına yazılır; böylece sayfa yenilense bile logo kaybolmaz.
- Dosya boyutu ve format kısıtları uygulama tarafında tanımlıdır; aşılırsa hata mesajı gösterilir.

---

*Devam eden bölümler eklenecektir. Üstteki arama alanı ile istenen kurallara hızlı erişim sağlanacaktır.*
