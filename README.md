# Task Earner Africa 🎙️🌍

A slick, mobile-first **task-earning platform for Africa** — turn your voice (and simple daily tasks) into cash. Read short scripts, play word games, complete daily tasks, and share sponsored posts, then withdraw straight to your bank. **Your voice is currency.**

**How it works:** Choose a task → Earn → Cashout to your bank.

> **Demo notice:** This is a front-end prototype. All balances, plans, and payments are simulated locally in your browser (`localStorage`). No real money moves.

## ✨ Features

- **Onboarding & auth** — landing page + sign up / log in (mock).
- **Dashboard** — greeting, swipeable wallet cards (Engagement / Sales / Deposit), bill-pay shortcuts, ways-to-earn grid, slide-out drawer, dark/light mode.
- **Earn hub** with four working activities:
  - **Voice Earn** — animated read-aloud session that highlights words and pays per session.
  - **Word Game** — 10-second countdown per word with a timer ring + text-to-speech "hear it".
  - **Daily Tasks** — checklist with progress ring and instant rewards.
  - **Sponsored Posts** — copy caption + "share & earn" verification.
- **Affiliate / Sales** — referral link, commission table, live referral list (simulate activations).
- **Wallet / Withdraw** — Engagement & Sales wallets, add bank account, withdrawal flow with minimum + payout history.
- **Fund Wallet** — deposit with a simulated MevonPay checkout.
- **Plans & Pricing** — five lifetime tiers; activate/upgrade from your deposit balance.
- **Profile** — setup progress, editable info, bank & social linking.
- **Transactions** — full activity history.
- **Top Affiliates** leaderboard & **Notifications**.
- **Bill payments** — Airtime, Data, Electricity, TV (debits your wallet).

## 🛠 Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** (custom purple brand system, dark mode)
- **Zustand** (persisted global state)
- **React Router** (deep-linked screens)
- **Framer Motion** (transitions) + **lucide-react** (icons)

## 🚀 Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # typecheck + production build to /dist
npm run preview  # preview the production build
npm run lint     # typecheck only
```

## 📁 Structure

```
src/
  components/     # shell (nav, drawer, layout), wallet cards, UI primitives
  pages/          # one file per screen
  store/          # Zustand store (wallets, plan, transactions, referrals)
  lib/            # data (plans, tasks, words), formatting helpers
```

## 🗺 Roadmap ideas

- Real backend (auth, ledger, payouts) + payment gateway integration.
- Real speech recognition scoring for Voice Earn / Word Game.
- Admin dashboard, KYC, anti-fraud, and referral abuse checks.
- Push notifications and PWA install.

---

Built as a UI/UX prototype. Not affiliated with any existing platform.
