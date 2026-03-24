# Ücretli kayıt Edge Function’ları — deploy

Workspace → Plan & Payment (mock ödeme) akışı iki fonksiyon ve ortak modül kullanır:

| Klasör | Amaç |
|--------|------|
| `create-pending-signup/` | Form verisini `pending_signups` tablosuna yazar, `pending_signup_id` + `signup_token` döner. |
| `mock-payment-success/` | “Ödeme OK” sonrası şirket + kullanıcı oluşturur; mantık `_shared/activatePaidSignup.ts`. |
| `_shared/activatePaidSignup.ts` | Deploy’da ayrı komut yok; yukarıdaki fonksiyonlar bundle sırasında dahil edilir. |

## 1. Veritabanı

Önce migration uygulanmış olmalı: `supabase/migrations/20260325000001_pending_signups.sql`  
(Supabase SQL Editor veya `supabase db push` ile proje sıranıza göre.)

## 2. Secret (önerilir)

**Supabase Dashboard** → **Edge Functions** → **Secrets**:

- `MOCK_PAYMENT_SECRET` — güçlü rastgele bir string (create-pending-signup ve mock-payment-success isteklerinde `x-mock-payment-secret` ile doğrulanır).

Aynı değeri yerelde `.env` içinde **`VITE_MOCK_PAYMENT_SECRET`** olarak verirseniz, Vite uygulaması bu header’ı otomatik ekler (bkz. `.env.example`).

> Secret tanımlı değilse fonksiyonlar header kontrolünü atlar (sadece geliştirme için; production’da secret kullanın).

## 3. CLI ile deploy

Proje kökünde, Supabase CLI ile projeye bağlı olduğunuzdan emin olun (`npx supabase link`).

```bash
npx supabase functions deploy create-pending-signup --no-verify-jwt
npx supabase functions deploy mock-payment-success --no-verify-jwt
```

**`--no-verify-jwt`:** Bu uçlar tarayıcıdan **anon key** ile çağrılır; JWT doğrulaması kapalı olmalıdır. Aksi halde istekler reddedilir.

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Edge ortamında Supabase tarafından sağlanır; ekstra tanımlamanız gerekmez.

## 4. Kontrol

Fonksiyon URL’leri: `https://<project-ref>.supabase.co/functions/v1/<function-name>`

- `POST` + `Content-Type: application/json`
- Header’lar: `Authorization: Bearer <VITE_SUPABASE_ANON_KEY>`, `apikey: <aynı anon key>`
- `MOCK_PAYMENT_SECRET` kullanıyorsanız: `x-mock-payment-secret: <aynı secret>`

İstek gövdeleri için kaynak: `src/services/paidSignupApi.ts` ve ilgili `index.ts` dosyaları.

## 5. Diğer fonksiyon

`payroll-rollover` için ayrı talimat: `payroll-rollover/README.md`.
