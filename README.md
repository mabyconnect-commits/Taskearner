# Task Earner Africa 🎙️🌍

A slick, mobile-first **task-earning platform for Africa** — turn your voice (and simple daily tasks) into cash. Read short scripts, play word games, complete daily tasks, and share sponsored posts, then withdraw straight to your bank. **Your voice is currency.**

**How it works:** Choose a task → Earn → Cashout to your bank.

> **Status:** Full-stack app. Accounts, wallets, earnings, referrals and the
> money ledger all live server-side (Postgres). Payments run through a
> pluggable gateway — **mock mode** (instant, no real money) by default, with a
> **NekPay** adapter ready for live keys. If the API is unreachable (e.g. the
> standalone HTML demo opened from a file), the app falls back to a local
> in-browser simulation so it still works.

## ✨ Features

- **Onboarding & auth** — landing page + real sign up / log in (JWT + bcrypt).
- **Dashboard** — greeting, swipeable wallet cards (Engagement / Sales / Deposit), bill-pay shortcuts, ways-to-earn grid, slide-out drawer, dark/light mode.
- **Earn hub** with four working activities:
  - **Voice Earn** — animated read-aloud session that highlights words and pays per session.
  - **Word Game** — 10-second countdown per word with a timer ring + text-to-speech "hear it".
  - **Daily Tasks** — checklist with progress ring and instant rewards.
  - **Sponsored Posts** — copy caption + "share & earn" verification.
- **Affiliate / Sales** — referral links; commissions pay out server-side the first time an invitee activates a plan.
- **Wallet / Withdraw** — Engagement & Sales wallets, add bank account, withdrawal flow with minimum + payout history.
- **Fund Wallet** — deposit through the NekPay gateway (mock mode settles instantly).
- **Plans & Pricing** — five lifetime tiers; activate/upgrade from your deposit balance (server-enforced pricing).
- **Profile** — setup progress, editable info, bank & social linking.
- **Transactions** — full activity history.
- **Top Affiliates** leaderboard & **Notifications**.
- **Bill payments** — Airtime, Data, Electricity, TV (debits your wallet).

## 🛠 Tech stack

**Frontend**
- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** (custom purple brand system, dark mode)
- **Zustand** (state, online-first with offline fallback)
- **React Router**, **Framer Motion**, **lucide-react**

**Backend** (all on Vercel)
- **Vercel Serverless Functions** (`/api`, one catch-all router)
- **Postgres** (Vercel Postgres / any `DATABASE_URL`) — auto-migrating schema
- **JWT** auth (`jsonwebtoken`) + **bcrypt** password hashing
- Pluggable **payment gateway** — `mock` or **NekPay**

## 🚀 Getting started

```bash
npm install
npm run dev      # Vite (5173) + API (3001) together
```

Needs a local Postgres at `postgres://taskearner:taskearner@127.0.0.1:5432/taskearner`
(or set `DATABASE_URL`). See `.env.example`.

Other scripts:

```bash
npm run build            # typecheck + production build to /dist
npm run build:standalone # single-file offline demo (dist-standalone/)
npm run lint             # typecheck frontend + backend
```

## 📁 Structure

```
src/                 # frontend
  components/         # shell (nav, drawer, layout), wallet cards, UI primitives
  pages/             # one file per screen
  store/             # Zustand store (online-first + offline fallback)
  lib/               # api client, data (plans/tasks/words), helpers
api/                 # backend (Vercel serverless)
  [...path].ts       # catch-all function entrypoint
  _router.ts         # request dispatcher + all endpoint logic
  _lib/              # db, auth, plans, state, payments (mock + nekpay)
server/dev.ts        # local dev server mounting the same router
```

## 🚢 Deploy

See **[DEPLOY.md](./DEPLOY.md)** — import to Vercel, add a Postgres store, set
env vars, and (when ready) plug in NekPay keys.

## 🗺 Roadmap ideas

- Finalise the NekPay integration against their live API docs + webhooks.
- Real speech-recognition scoring for Voice Earn / Word Game.
- Admin dashboard, KYC, anti-fraud, and referral-abuse checks.
- Push notifications and PWA install.

---

Built as a product prototype. Not affiliated with any existing platform.
