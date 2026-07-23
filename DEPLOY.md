# Deploying Task Earner Africa to Vercel

The app is a Vite single-page frontend plus a serverless API (in `/api`) backed
by Postgres — all hosted on Vercel.

## 1. Import the repo

1. Go to **[vercel.com/new](https://vercel.com/new)** → log in with GitHub.
2. Import **`mabyconnect-commits/Taskearner`**.
3. Vercel auto-detects the settings — leave them as-is:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - The `/api` folder is deployed as a Serverless Function automatically.

## 2. Add a Postgres database (one click)

1. In your new project → **Storage** tab → **Create Database** → **Postgres**.
2. Connect it to the project. Vercel injects `POSTGRES_URL` (and friends) as
   environment variables automatically. The app reads `POSTGRES_URL` or
   `DATABASE_URL`.
3. Tables are created automatically on the first request (auto-migration) — no
   manual SQL needed.

## 3. Set environment variables

Project → **Settings → Environment Variables**:

| Key | Value |
|-----|-------|
| `JWT_SECRET` | a long random string |
| `APP_URL` | your deployment URL, e.g. `https://taskearner.vercel.app` |
| `PAYMENT_PROVIDER` | `mock` for now, or `nekpay` to go live |

`POSTGRES_URL` is set for you by step 2.

## 4. Go live with NekPay (when ready)

Add these and set `PAYMENT_PROVIDER=nekpay`:

| Key | Value |
|-----|-------|
| `NEKPAY_SECRET_KEY` | `sk_live_…` |
| `NEKPAY_PUBLIC_KEY` | `pk_live_…` |
| `NEKPAY_BASE_URL` | only if different from `https://api.nekpay.com` |

> ⚠️ **Confirm the NekPay integration.** The adapter in
> `api/_lib/payments/nekpay.ts` uses common Paystack-style endpoints
> (`/transaction/initialize`, `/transaction/verify/:ref`, `/transfer`) and an
> HMAC-SHA512 webhook signature. Check these against NekPay's official API docs
> and adjust the paths/fields/signature if they differ. Point NekPay's webhook
> to `https://<your-app>/api/payments/webhook`.

Then redeploy.

## Local development

```bash
npm install
npm run dev      # runs Vite (5173) + API (3001) together
```

A local Postgres is expected at
`postgres://taskearner:taskearner@127.0.0.1:5432/taskearner` (override with
`DATABASE_URL`). The API runs in `mock` payment mode by default, so funding and
payouts settle instantly for testing.

## How it works

- **Frontend** (`src/`) talks to the backend through `/api/*`.
- **Backend** (`api/`) is one catch-all Serverless Function that routes every
  request through `api/_router.ts` (auth, wallet ledger, earning, plans,
  referrals, funding, withdrawals). The same dispatcher runs locally via
  `server/dev.ts`.
- **Offline fallback:** if the API is unreachable (e.g. the standalone HTML
  demo opened from a file), the app automatically falls back to a local
  in-browser simulation so it still works.
