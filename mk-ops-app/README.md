# MK OPS Mobile

**MK OPS** saha operasyon yönetim platformunun Flutter tabanlı mobil uygulamasıdır.

## Gereksinimler

- Flutter SDK 3.0+
- Dart 3.0+
- Android Studio veya VS Code
- Mevcut MK OPS Supabase projesi

## Kurulum

### 1. Bağımlılıkları yükle

```bash
cd mk-ops-app
flutter pub get
```

### 2. .env dosyasını oluştur

```bash
cp .env.example .env
```

`.env` dosyasını aç ve mevcut web uygulamasının Supabase bilgilerini gir:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ Service Role Key **kesinlikle** mobil uygulamaya eklenmemelidir.

### 3. Uygulamayı çalıştır

```bash
flutter run
```

## Build

### Android APK (Test için)

```bash
flutter build apk --release
```

Çıktı: `build/app/outputs/flutter-apk/app-release.apk`

### Android App Bundle (Play Store için)

```bash
flutter build appbundle --release
```

Çıktı: `build/app/outputs/bundle/release/app-release.aab`

### iOS

```bash
flutter build ios --release
```

## Proje Yapısı

```
mk-ops-app/
├── lib/
│   ├── main.dart                    # Uygulama giriş noktası
│   ├── core/
│   │   ├── constants/               # Sabit değerler, tablo isimleri
│   │   ├── models/                  # Veri modelleri (Company, Profile, Job...)
│   │   ├── providers/               # Riverpod state management
│   │   ├── router/                  # GoRouter navigasyon
│   │   ├── services/                # Supabase servisleri
│   │   └── theme/                   # Tema, renkler
│   ├── features/
│   │   ├── auth/                    # Giriş, Kayıt, Şifre Sıfırlama
│   │   ├── dashboard/               # Ana Sayfa
│   │   ├── jobs/                    # İş Girişi, İşlerim, İş Detayı
│   │   ├── approvals/               # İş Onayları
│   │   ├── projects/                # Projeler
│   │   ├── teams/                   # Ekipler
│   │   ├── payroll/                 # Hakediş
│   │   ├── reports/                 # Raporlar (Excel Export)
│   │   ├── notifications/           # Bildirimler
│   │   └── profile/                 # Profil & Çıkış
│   └── shared/
│       └── widgets/                 # Ortak bileşenler
├── .env                             # Supabase URL & Anon Key (git'e ekleme!)
├── .env.example                     # Örnek .env dosyası
└── pubspec.yaml                     # Bağımlılıklar
```

## Supabase Bağlantısı

Mobil uygulama mevcut web uygulamasıyla **aynı Supabase projesini** kullanır.

- Yeni veritabanı oluşturulmaz.
- Mevcut RLS kuralları geçerlidir.
- Service Role Key kullanılmaz; tüm işlemler kullanıcı token'ı ile yapılır.

## Roller ve Yetki

| Rol | Türkçe | Yetkiler |
|-----|--------|----------|
| `companyManager` | Şirket Yöneticisi | Tüm veriler, onay, raporlar |
| `projectManager` | Proje Yöneticisi | Tüm veriler, onay, raporlar |
| `teamLeader` | Ekip Lideri | Kendi ekibi ve işleri |
| `superAdmin` | Süper Admin | Yalnızca web panelinde |

## Mobil V1'de Olmayan Özellikler

Aşağıdaki modüller yalnızca web sürümünde bulunur:

- Merkez stok yönetimi
- Malzeme zimmeti ve irsaliye
- Kablo/boru stok takibi
- Araç ve yakıt yönetimi
- Süper admin paneli
- Gelişmiş şirket ayarları

## Sık Sorulan Sorular

**Q: `SUPABASE_URL not found` hatası alıyorum.**  
A: `.env` dosyasının `mk-ops-app/` içinde olduğundan emin ol.

**Q: Giriş yapıyorum ama ana sayfaya geçmiyor.**  
A: Kullanıcının `role_approval_status = 'approved'` olması ve şirketinin `subscription_status = 'active'` olması gerekir.

**Q: Ekip lideri tüm projeleri görüyor.**  
A: Projeler herkes tarafından görülebilir, ancak iş girişi için yalnızca aktif projeler listelenir ve yalnızca lider olduğu ekibe iş girebilir.

---

© MK Digital Systems — MK OPS Mobile V1
