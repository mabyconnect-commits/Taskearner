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

## 4. Go live with NEKpay (when ready)

The adapter (`api/_lib/payments/nekpay.ts`) implements NEKpay per the integration
brief: MD5-signed form-urlencoded **pay-in** (`/pay/web` → signed callback →
idempotent credit → reply `success`), and **pay-out** through the fixed-IP
**relay** (the app never holds the withdrawal key). Set `PAYMENT_PROVIDER=nekpay`
and add:

**Deposits (pay-in):**
| Key | Value |
|-----|-------|
| `NEKPAY_MCH_ID` | merchant id (2nd account) |
| `NEKPAY_KEY` | pay-in secret key (代收密钥) |
| `NEKPAY_PAY_TYPE` | channel/通道编码 |
| `NEKPAY_API_URL` | `https://api.nekpayment.com` |

**Withdrawals (pay-out, via relay):**
| Key | Value |
|-----|-------|
| `NEKPAY_RELAY_URL` | `http://5.223.51.249:<relay-2 PORT>` |
| `NEKPAY_RELAY_SECRET` | relay-2 `RELAY_SECRET` (from the box: `pm2 env <id>`) |
| `NAIRA_AUTO_MAX_NGN` | `65000` (auto-send ceiling) |

**Callbacks** — configured automatically from `APP_URL`. NEKpay posts to
`…/api/deposits/nekpay/callback`; the relay posts to
`…/api/withdrawals/naira/callback`. Make sure `APP_URL` is your real domain.

> ⚠️ **Two things to confirm before real money:**
> 1. The **bank_code map** in `api/_lib/payments/banks.ts` — replace the
>    placeholder codes with NEKpay's official `bank_code` list (port the
>    reference `nekpayBanks.ts`). Moniepoint/FairMoney/Carbon are routed to the
>    manual queue by design.
> 2. The **relay** for the 2nd account must be running and its box IP
>    whitelisted on NEKpay (per the brief it already is).
>
> Test order: `/api/health` green → one small deposit reflects → one small
> withdrawal to a supported bank settles.

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
