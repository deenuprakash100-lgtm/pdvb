# PDVB - local delivery website

Next.js 14 + TypeScript + Tailwind + PostgreSQL (Prisma) + Razorpay + WhatsApp Business Cloud API.
Five categories (food, groceries, vegetables, chicken & meat, medicine), cart, checkout, online payment, Cash on Delivery,
admin dashboard, and automatic WhatsApp order alerts. Money is stored as integer paise; prices and totals are calculated only on the server.

> **Status: v0.1 (phases 1-6 core implemented, not yet run end to end).** See [Honest status](#honest-status) before going live.

## Quick start

Requirements: Node 20.11+ (22 works), Docker (or any PostgreSQL 14+).

```bash
git clone <your-repo-url> pdvb && cd pdvb
cp .env.example .env            # then edit values (see below)
docker compose up -d            # starts PostgreSQL on :5432
npm install
npx prisma migrate dev --name init   # creates tables (commits the first migration into prisma/migrations)
npm run db:seed                 # categories, 5 shops, 42 groceries, vegetables, meat, coupons, admin user
npm run dev                     # http://localhost:3000
```

- Admin: http://localhost:3000/admin/login using `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`.
- Set `AUTH_SECRET` first: `openssl rand -base64 48`.
- Commit `prisma/migrations/` to Git after the first `migrate dev`.
- Seeded PIN codes are placeholders (`SEED_PINCODES`). Replace with your real delivery PIN codes in **Admin > Settings**.

## Configure for your business (Admin > Settings)

Business name, headline, logo URL, phone, WhatsApp number, email, address, service area, hours, delivery fee, free-delivery threshold,
minimum order, tax, COD on/off and limit, serviceable PIN codes, medicine switch, WhatsApp alert settings. Phone/WhatsApp/email links
across the site (`tel:`, `wa.me`, `mailto:`) are generated from these values; nothing is hard-coded.

Rename the five placeholder shops in **Admin > Shops**. Update daily vegetable prices and stock in **Admin > Products**.

## Razorpay (test mode first)

1. Create a Razorpay account, switch to **Test mode**, copy Key ID / Key Secret into `.env`.
2. Dashboard > Settings > Payment capture: choose **automatic capture**.
3. Dashboard > Webhooks: add `https://YOUR_DOMAIN/api/webhooks/razorpay`, set a secret (same as `RAZORPAY_WEBHOOK_SECRET`), enable events:
   `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.
4. Local webhook testing: expose localhost with a tunnel (ngrok / cloudflared) and use the tunnel URL.
5. Test with Razorpay's test cards/UPI, then go live only after the launch checklist.

Flow: `/api/checkout` creates a PENDING order and a Razorpay order from **server-calculated** totals ->
browser opens Razorpay -> `/api/payments/verify` checks the HMAC signature **and** re-fetches the payment from Razorpay ->
`markPaymentPaid()` (idempotent) -> order CONFIRMED + WhatsApp job queued. The webhook runs the same idempotent function, so
closed tabs and retries are safe. Browser success alone never marks an order paid.

## WhatsApp order alerts

Business-initiated WhatsApp messages must use an **approved template**. Create this in Meta WhatsApp Manager
(category: Utility, language: `en`, name: `pdvb_new_order`):

```
PDVB {{1}}
Order: {{2}}
Customer: {{3}} ({{4}})
Address: {{5}}
Items: {{6}}
{{7}}
Instructions: {{8}}
```

Then:
1. Put `WHATSAPP_ACCESS_TOKEN` (a permanent system-user token) in `.env` / your host's secret store. **It is never stored in the database or sent to the browser.**
2. In Admin > Settings set: recipient number, phone number ID, template name/language, API version.
3. Set `WHATSAPP_MODE="live"`.
4. Optional delivery receipts: webhook `https://YOUR_DOMAIN/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, app secret = `WHATSAPP_APP_SECRET`.
5. Schedule retries (every minute): `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/notifications/process`

Behaviour: the order is saved first; the notification job is written in the same database transaction; sends are retried with
backoff (5 attempts); duplicates are blocked by a unique `dedupeKey`; admins can retry from the order page.
**Demo mode** (default) stores the message text and marks the job `DEMO` - nothing is sent, and the UI says so.
The **click-to-chat** button on the admin order page opens WhatsApp with a prefilled message; **it does not send automatically** - a person must press Send.

## Project layout

```
prisma/            schema.prisma, seed.ts
src/lib/           pricing.ts, quote.ts (server price authority), payments.ts, notify*.ts, signatures.ts, auth.ts, settings.ts
src/app/api/       cart/quote, checkout, payments/verify, webhooks/{razorpay,whatsapp}, notifications/process, admin/orders/export
src/app/           customer pages (home, c/[slug], shop, product, search, cart, checkout, order, track, policies)
src/app/admin/     login, dashboard, orders (+detail), products, shops, settings; actions.ts holds all admin mutations
tests/             vitest unit tests for pricing, coupons, signatures, message content
```

## API reference

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/cart/quote` | none, rate-limited | Body `{items:[{variantId,qty}], couponCode?, pincode?, paymentMethod?}` -> priced lines, totals, errors. Prices never come from the client. |
| `POST /api/checkout` | none, rate-limited, `Idempotency-Key` header | Validates everything, reserves stock, creates order. ONLINE returns Razorpay params; COD returns order + token. Same key = same order. |
| `POST /api/payments/verify` | none (signature-verified) | Verifies Razorpay signature + fetches payment from Razorpay, then marks paid idempotently. |
| `POST /api/webhooks/razorpay` | HMAC signature | Idempotent by `x-razorpay-event-id`. Handles captured/authorized/failed/refund.processed. |
| `GET/POST /api/webhooks/whatsapp` | Meta verify token / HMAC | Delivery receipts update notification status. |
| `POST /api/notifications/process` | `Bearer CRON_SECRET` | Processes due notification jobs. |
| `GET /api/admin/orders/export` | admin/staff session | CSV export (formula-injection safe). |

Admin mutations are server actions in `src/app/admin/actions.ts`, each re-checking the role (`ADMIN` for prices/stock/settings/refunds, `ADMIN` or `STAFF` for orders).

## Tests

```bash
npm test         # vitest: pricing, coupons, signatures, WhatsApp message content
npm run typecheck
```

## Deployment

- **Host**: any Node host (Render, Railway, Fly.io, a VPS) or Vercel with a managed Postgres (Neon, Supabase, RDS).
- Build: `npm run build`; start: `npm start`; run `npx prisma migrate deploy` on each release.
- Set all `.env` values as host secrets. Use HTTPS. Set `APP_URL`.
- Run the cron call for `/api/notifications/process` every minute.
- Backups: enable daily automated Postgres backups with point-in-time recovery; test a restore before launch.
- Rate limiting is in-memory (single instance). For multiple instances, move it to Redis/Upstash.
- Add error monitoring (Sentry or similar).

## Honest status

**Written and checked here**
- Pricing, coupon and signature logic, and WhatsApp message wording: 15 assertions executed and passing against the compiled modules (no database needed).

**Written but NOT yet executed** (this environment had no network, so `npm install`, Prisma, the Next.js build and a browser were unavailable)
- The full Next.js app, Prisma schema/migrations, seed, API routes, admin pages, vitest suite. Expect some small type or runtime fixes on first `npm install && npm run typecheck && npm run build`.
- Razorpay test-mode payments, webhooks, and WhatsApp live sending have **not** been tested against the real services. Do that with sandbox keys before launch.

**Not built yet (remaining work)**
- Customer accounts and saved addresses (guests check out; orders are tracked by order ID + phone, and an unguessable link).
- Server-side carts table (cart lives in the browser; the server always re-prices it).
- Image upload/storage (products use emoji placeholders; `imageUrl` accepts any https URL set in the database).
- Prescription upload and pharmacist verification UI (schema exists; medicine checkout stays disabled and prescription items are blocked).
- Product/coupon create and edit forms in admin (price/stock/availability/archive and shop/settings editing exist).
- Email notifications, partial refunds, stock release for abandoned online payments (add a cron to cancel stale PENDING online orders).
- Integration and browser tests, CSRF hardening review, a Playwright responsive test pass.

## Production launch checklist

- [ ] `npm run typecheck`, `npm test`, `npm run build` all pass
- [ ] Razorpay test-mode: success, failure, retry, closed-tab-then-webhook, duplicate webhook all verified
- [ ] Switch Razorpay to live keys and re-register the live webhook
- [ ] WhatsApp template approved; one real paid-order and one COD alert received
- [ ] Admin password changed; `SEED_ADMIN_PASSWORD` removed from the server; extra staff accounts created
- [ ] Real PIN codes, delivery fee, minimum order, hours, shop names, prices entered
- [ ] Policy pages replaced with reviewed text (terms, privacy, refunds, delivery)
- [ ] Medicine checkout left **disabled** unless you hold the legally required pharmacy authorisation and prescription process
- [ ] Business registrations and GST/FSSAI/trade licences obtained as applicable to your goods
- [ ] HTTPS, backups with a tested restore, monitoring, cron job for notifications
