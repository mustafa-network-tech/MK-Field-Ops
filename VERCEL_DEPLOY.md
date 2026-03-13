# Vercel'de MK-OPS Güncelleme (Deploy)

Landing sayfası, giriş sekmesi ve diğer değişikliklerinizi Vercel’e yansıtmak için aşağıdaki adımları kullanın.

---

## 1. Değişiklikleri commit edin

Proje klasöründe:

```bash
git add .
git status
git commit -m "Landing, login ve hukuki sayfalar güncellendi"
```

---

## 2. GitHub / GitLab’a gönderin

```bash
git push origin main
```

(Branch adınız `master` ise: `git push origin master`)

---

## 3. Vercel’de otomatik güncelleme

- Projeniz Vercel’e GitHub/GitLab ile bağlıysa **her `git push` sonrası otomatik build ve deploy** yapılır.
- [vercel.com](https://vercel.com) → Dashboard → projenizi seçin → **Deployments** sekmesinde son deployment’ı kontrol edin.
- “Building” / “Ready” durumunu bekleyin; “Ready” olunca yeni landing ve login değişiklikleri canlı sitede görünür.

---

## 4. Elle (manuel) deploy

- Vercel CLI ile: `npx vercel --prod` (proje kökünde).
- Veya Dashboard’dan: **Deployments** → **Redeploy** (son deployment’ın yanındaki üç nokta).

---

## 5. Ortam değişkenleri (Supabase)

Supabase kullanıyorsanız Vercel’de şunlar tanımlı olmalı:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Vercel Dashboard** → Proje → **Settings** → **Environment Variables** → bu değişkenleri ekleyin veya güncelleyin. Değiştirdikten sonra **Redeploy** yapın.

---

## 6. Build ayarları (Vite)

Vercel varsayılan olarak şunları kullanır:

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

Özel bir ayar yoksa `package.json` içindeki `build` script’i yeterlidir. Gerekirse proje köküne `vercel.json` ekleyebilirsiniz (aşağıda örnek var).

---

## Özet

1. Değişiklikleri **commit** edin.  
2. **Push** edin (`git push`).  
3. Vercel bağlıysa deploy **otomatik** başlar.  
4. **Deployments** sekmesinden durumu kontrol edin.  
5. Supabase kullanıyorsanız **Environment Variables**’ı kontrol edin.

Bu adımlarla landing, login ve diğer güncellemeleriniz Vercel’de yayına alınmış olur.
