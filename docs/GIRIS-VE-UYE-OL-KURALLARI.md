# Giriş ve Üye Ol – Kurallar ve Gereklilikler (MKfieldOPS)

Bu belge, uygulamadaki **giriş (login)** ve **kayıt (üye ol / register)** akışlarının tüm kurallarını ve alan gereksinimlerini Türkçe olarak özetler.

---

## 1. GİRİŞ (LOGIN)

### 1.1 Form alanları ve zorunluluklar

| Alan       | Zorunlu | Açıklama |
|-----------|--------|----------|
| E-posta   | Evet   | Geçerli e-posta formatında olmalı (`type="email"`, tarayıcı doğrulaması). |
| Şifre     | Evet   | Boş bırakılamaz. |

### 1.2 Giriş kuralları

- **E-posta ve şifre:** Supabase kullanılıyorsa Supabase Auth ile doğrulanır; yoksa yerel store’daki kullanıcılar ile karşılaştırılır. Eşleşmezse: *"Geçersiz e-posta veya şifre"* (auth.loginError).
- **Onay durumu:** Kullanıcının **rol onayı (role_approval_status)** mutlaka **onaylı (approved)** olmalıdır. Onay bekleyen veya reddedilen kullanıcı giriş yapamaz; hata: *"Hesabınız oluşturuldu ancak henüz onaylanmadı. Şirket yöneticisi sizi onaylayana kadar giriş yapamazsınız."* (auth.pendingApproval).
- **Yönlendirme:**
  - Şirketi olan (company_id atanmış) kullanıcı → Ana sayfa (`/`).
  - Şirketi olmayan (ör. katılım talebi bekleyen) kullanıcı → `/pending-join`.

### 1.3 Şifremi unuttum

- **Sayfa:** `/forgot-password`
- **Kural:** Supabase yapılandırılmışsa e-posta ile şifre sıfırlama bağlantısı gönderilir. Supabase yoksa: *"Şifre sıfırlama bu ortamda etkin değil."* (auth.forgotPasswordNotConfigured).

---

## 2. ÜYE OL (KAYIT) – GENEL AKIŞ

Kayıt iki adımlıdır:

1. **Adım 1 – Register (`/register`):** Ad, soyad, e-posta ve şifre toplanır.
2. **Adım 2 – Workspace (`/workspace`):** Kullanıcı ya **yeni şirket oluşturur** ya da **mevcut şirkete katılır**.

---

## 3. KAYIT ADIM 1 – REGISTER (`/register`)

### 3.1 Form alanları ve zorunluluklar

| Alan    | Zorunlu | Açıklama |
|---------|--------|----------|
| Ad      | Evet   | Boş veya sadece boşluk olamaz (client’ta kontrol). |
| Soyad   | Evet   | Boş veya sadece boşluk olamaz (client’ta kontrol). |
| E-posta | Evet   | Geçerli e-posta formatı (`type="email"`). |
| Şifre   | Evet   | Boş bırakılamaz. |

### 3.2 Kurallar

- Ad veya soyad boş/trim sonrası boşsa: *"Zorunlu alan"* (validation.required) gösterilir.
- Plan seçimi: URL’de `?plan=starter|professional|enterprise` varsa o plan Workspace’e taşınır; yoksa varsayılan **professional** kullanılır.
- Bu adımda henüz veritabanına/ Supabase’e yazılmaz; tüm bilgiler `/workspace` sayfasına `state` ile gönderilir. Workspace’e sadece `email`, `password`, `fullName` ve isteğe bağlı `plan` ile gidilir.

---

## 4. KAYIT ADIM 2 – WORKSPACE: YENİ ŞİRKET OLUŞTURMA

### 4.1 Form alanları ve zorunluluklar

| Alan           | Zorunlu | Açıklama |
|----------------|--------|----------|
| Şirket adı     | Evet   | Boş olamaz (client’ta kontrol). |
| Katılım kodu   | Evet   | **Tam 4 rakam** olmalı (örn. 1234). Sadece rakam kabul edilir, en fazla 4 karakter. |
| Plan           | Evet   | starter / professional / enterprise. |
| Fatura dönemi  | Hayır  | Aylık (varsayılan) veya yıllık. |

### 4.2 Kurallar ve hata mesajları

- **Katılım kodu:** Regex `^\d{4}$` ile kontrol. 4 rakam değilse: *"Katılım kodu tam 4 rakam olmalıdır."* (auth.joinCodeInvalid).
- **Şirket adı:** Boşsa: *"Zorunlu alan"* (validation.required).
- **Şirket adı tekrarı (Supabase yokken):** Aynı şirket adı (normalize edilmiş) zaten varsa: *"Bu şirket adı zaten kullanılıyor."* (auth.companyNameExists).
- **E-posta tekrarı:** Bu e-posta sistemde (ve gerekiyorsa ilgili şirkette) zaten kayıtlıysa: *"Bu e-posta zaten kayıtlı."* (auth.emailExists).
- **Supabase’de şirket insert hatası (örn. unique):** Şirket adı çakışmasında yine auth.companyNameExists kullanılabilir; diğer hatalar API mesajı ile döner.

### 4.3 Başarılı kayıt sonrası

- Kullanıcı **Company Manager** olarak oluşturulur, rol onayı **approved**.
- Starter plan seçildiyse şirket için **varsayılan kampanya ve proje** otomatik oluşturulur.
- Yönlendirme: `/plan-and-payment?plan=...&from=registration` (ödeme / plan sayfası).

---

## 5. KAYIT ADIM 2 – WORKSPACE: MEVCUT ŞİRKETE KATILMA

### 5.1 Form alanları ve zorunluluklar

| Alan           | Zorunlu | Açıklama |
|----------------|--------|----------|
| Şirket adı     | Evet   | Boş olamaz. |
| Katılım kodu   | Evet   | **Tam 4 rakam** (aynı kural: `^\d{4}$`). |

### 5.2 Kurallar ve hata mesajları

- **Katılım kodu:** 4 rakam değilse: *"Katılım kodu tam 4 rakam olmalıdır."* (auth.joinCodeInvalid).
- **Şirket adı:** Boşsa: *"Zorunlu alan"* (validation.required).
- **Şirket bulunamadı:** Şirket adı + katılım kodu eşleşmesi yoksa (Supabase’de RPC veya local’de şirket listesi): *"Bu şirket bulunamadı."* (auth.companyNotFound).
- **E-posta zaten bu şirkette kayıtlı:** *"Bu e-posta zaten kayıtlı."* (auth.emailExists).
- **Plan kullanıcı limiti:** Şirketin planına göre kullanıcı sayısı limiti doluysa: *"Kullanıcı limiti doldu. Plan yükseltmek için şirket yöneticinizle iletişime geçin."* (onboarding.userLimitReached).

### 5.3 Başarılı kayıt sonrası

- Kullanıcı **onay bekler (pending)** durumda oluşturulur; rol atanmaz, şirket yöneticisi onaylayana kadar giriş yapamaz.
- Mesaj: *"Hesabınız oluşturuldu. Şirket yöneticisi sizi onaylayana kadar giriş yapamazsınız; onay sonrası giriş yapabilirsiniz."* (auth.pendingCompanyManagerApproval).
- Kısa süre sonra kullanıcı `/login` sayfasına yönlendirilir.

---

## 6. ÖZET TABLO

| Konu                  | Kural / Gereklilik |
|-----------------------|--------------------|
| Giriş – e-posta       | Zorunlu, geçerli e-posta formatı. |
| Giriş – şifre         | Zorunlu. |
| Giriş – onay          | Sadece rol onayı **approved** olanlar giriş yapabilir. |
| Kayıt – ad/soyad      | İkisi de zorunlu, boş olamaz. |
| Kayıt – e-posta       | Zorunlu, geçerli e-posta; sistemde tekil olmalı (yeni şirkette veya katılınan şirkette). |
| Kayıt – şifre         | Zorunlu. |
| Yeni şirket – şirket adı | Zorunlu; aynı isimde şirket varsa (normalize) kabul edilmez. |
| Yeni şirket – katılım kodu | Zorunlu, **tam 4 rakam**. |
| Yeni şirket – plan    | Zorunlu: starter / professional / enterprise. |
| Mevcut şirket – şirket adı | Zorunlu; şirket adı + 4 rakam kod ile eşleşen şirket bulunmalı. |
| Mevcut şirket – katılım kodu | Zorunlu, **tam 4 rakam**. |
| Mevcut şirket – limit | Plan kullanıcı limiti aşılmamış olmalı. |

---

## 7. TEKNİK NOTLAR

- **Katılım kodu:** Her zaman 4 haneli sayı (string). UI’da sadece rakam girişi ve en fazla 4 karakter kabul edilir.
- **Şirket adı karşılaştırma:** Türkçe karakterler normalize edilir (ğ→g, ü→u, ş→s, ı→i, ö→o, ç→c), küçük harfe çevrilir.
- **Şirkette tek Company Manager:** Onay ekranında ikinci bir kullanıcıya Company Manager rolü verilemez; bir şirkette yalnızca bir Company Manager olabilir.
- **Starter plan:** Yeni şirket oluşturulduğunda veya uygulama açıldığında Starter plan için varsayılan bir kampanya ve bir proje otomatik oluşturulur; böylece iş girişi yapılabilir.

Bu belge, mevcut `authService`, `Login`, `Register` ve `Workspace` sayfalarına göre hazırlanmıştır. Değişiklik yapıldıkça dokümanın güncellenmesi önerilir.
