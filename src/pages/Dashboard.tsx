import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu, Bell, Smartphone, Wifi, Zap, Tv, Crown, X, Mic, Gamepad2, CheckCircle2, Megaphone,
  ArrowRight, Share2, Copy, Check, ArrowUp, Users, TrendingUp, Lock, Trophy, Rocket, ChevronRight, MonitorSmartphone,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { greeting, formatNaira } from "@/lib/format";
import { planById } from "@/lib/data";
import { Layout } from "@/components/Layout";
import { Drawer } from "@/components/Drawer";
import { WalletCards } from "@/components/WalletCards";
import { Sheet } from "@/components/ui/Sheet";
import { TelegramCard } from "@/components/JoinTelegram";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const DAILY_GOAL = 5;

const quickActions = [
  { id: "airtime", label: "Airtime", icon: Smartphone, bg: "bg-brand-100 dark:bg-brand-500/20", fg: "text-brand-600 dark:text-brand-300", offset: "translate-y-0" },
  { id: "data", label: "Data", icon: Wifi, bg: "bg-emerald-100 dark:bg-emerald-500/20", fg: "text-emerald-500", offset: "translate-y-5" },
  { id: "electricity", label: "Electricity", icon: Zap, bg: "bg-amber-100 dark:bg-amber-500/20", fg: "text-amber-500", offset: "translate-y-5" },
  { id: "tv", label: "TV", icon: Tv, bg: "bg-rose-100 dark:bg-rose-500/20", fg: "text-rose-500", offset: "translate-y-0" },
];

const earnWays = [
  { id: "voice", label: "Voice Earn", icon: Mic, to: "/earn/voice", bg: "bg-brand-500" },
  { id: "word", label: "Word Game", icon: Gamepad2, to: "/earn/word-game", bg: "bg-emerald-500" },
  { id: "tasks", label: "Daily Tasks", icon: CheckCircle2, to: "/earn/tasks", bg: "bg-amber-500" },
  { id: "posts", label: "Sponsored", icon: Megaphone, to: "/earn/sponsored", bg: "bg-rose-500" },
];

export default function Dashboard() {
  const nav = useNavigate();
  const toast = useToast();
  const { name, username, plan, bank, socialLinked, transactions, referrals } = useStore();
  const [drawer, setDrawer] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [copied, setCopied] = useState(false);
  const [topClub, setTopClub] = useState(false);
  const first = name?.split(" ")[0] || "Star";

  // --- setup steps (next step to start earning) ---
  const steps = [
    { done: !!bank, label: "Add your bank account", sub: "Needed for withdrawals", to: "/wallet" },
    { done: plan !== "free", label: "Activate a plan", sub: "Pay once, earn forever", to: "/packages" },
    { done: socialLinked, label: "Link your socials", sub: "For sponsored posts", to: "/profile" },
  ];
  const setupDone = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  // --- overview stats ---
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();
  const earnTypes = ["voice", "word", "task", "post", "commission"];
  const todaysEarnings = transactions
    .filter((t) => t.amount > 0 && earnTypes.includes(t.type) && t.ts >= todayStart)
    .reduce((s, t) => s + t.amount, 0);
  const activitiesToday = transactions.filter(
    (t) => ["voice", "word", "task", "post"].includes(t.type) && t.ts >= todayStart,
  ).length;
  const remaining = Math.max(0, DAILY_GOAL - activitiesToday);
  const withdrawnLifetime = transactions.filter((t) => t.type === "withdraw").reduce((s, t) => s + Math.abs(t.amount), 0);

  // --- referral ---
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/signup?ref=${username || "guest"}`;
  const activated = referrals.filter((r) => r.status === "activated").length;
  const pending = referrals.filter((r) => r.status === "pending").length;
  const copyRef = () => {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast("Referral link copied!");
  };

  return (
    <Layout>
      <Drawer open={drawer} onClose={() => setDrawer(false)} />

      {/* top bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => setDrawer(true)} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
        <button onClick={() => nav("/profile")} className="grid h-11 w-11 place-items-center rounded-full bg-ink-900 font-bold text-brand-400">
          {first[0].toUpperCase()}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-400">{greeting()}</p>
          <p className="-mt-0.5 truncate font-display text-xl font-bold">{first}</p>
        </div>
        <button onClick={() => nav("/notifications")} className="relative grid h-11 w-11 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0b0710]" />
        </button>
      </div>

      {/* alert banner */}
      {showBanner && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
          <p className="flex-1 text-sm font-semibold text-brand-700 dark:text-brand-200">
            Do not place withdrawals using Moniepoint or Paga as your bank.
          </p>
          <button onClick={() => setShowBanner(false)} className="text-brand-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* wallet cards */}
      <div className="mt-5">
        <WalletCards />
      </div>

      {/* quick actions arc */}
      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Pay bills</h2>
          <span className="text-xs font-semibold text-slate-400">Instant & secure</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => (
            <button
              key={a.id}
              onClick={() => nav(`/bills/${a.id}`)}
              className={cn("flex flex-col items-center gap-2 rounded-2xl py-3 transition active:scale-95")}
            >
              <span className={cn("grid h-14 w-14 place-items-center rounded-2xl", a.bg, a.fg)}>
                <a.icon className="h-6 w-6" />
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ways to earn */}
      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Ways to earn</h2>
          <button onClick={() => nav("/earn")} className="text-sm font-bold text-brand-600 dark:text-brand-300">
            See all
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {earnWays.map((w) => (
            <button
              key={w.id}
              onClick={() => nav(w.to)}
              className="card flex items-center gap-3 p-4 text-left transition active:scale-[0.98]"
            >
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white", w.bg)}>
                <w.icon className="h-5 w-5" />
              </span>
              <span className="font-bold leading-tight">{w.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* join telegram */}
      <TelegramCard />

      {/* next step to start earning */}
      {nextStep && (
        <button
          onClick={() => nav(nextStep.to)}
          className="relative mt-7 flex w-full items-center gap-4 overflow-hidden rounded-4xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-5 text-left text-white shadow-card"
        >
          <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative grid h-16 w-16 shrink-0 place-items-center">
            <svg className="absolute h-16 w-16 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" className="fill-none stroke-white/25" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="44" className="fill-none stroke-white" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 * (1 - setupDone / steps.length)}
              />
            </svg>
            <span className="font-display text-sm font-extrabold">{setupDone}/{steps.length}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Next step to start earning</p>
            <p className="font-display text-xl font-extrabold leading-tight">{nextStep.label}</p>
            <p className="text-sm text-white/70">{nextStep.sub}</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-500 text-slate-900">
            <ArrowRight className="h-5 w-5" />
          </span>
        </button>
      )}

      {/* overview */}
      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Overview</h2>
          <button onClick={() => nav("/transactions")} className="text-sm font-bold text-brand-600 dark:text-brand-300">
            All transactions
          </button>
        </div>

        {/* today's earnings */}
        <div className="relative mb-3 overflow-hidden rounded-3xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-5 text-white shadow-card">
          <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-brand-500/20 blur-2xl" />
          <div className="flex items-center gap-2 text-sm text-white/60">
            <TrendingUp className="h-4 w-4 text-brand-400" /> Today's earnings
          </div>
          <p className="mt-1 font-display text-4xl font-extrabold text-brand-400">{formatNaira(todaysEarnings)}</p>
          <p className="mt-1 text-sm text-white/50">{activitiesToday} activities today · {remaining} more to hit your daily goal</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-500 dark:bg-amber-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <p className="mt-3 font-display text-3xl font-extrabold">{activitiesToday}</p>
            <p className="text-sm text-slate-400">Voice/Task done · {remaining} to daily goal</p>
          </div>
          <div className="card p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-500 dark:bg-rose-500/20">
              <ArrowUp className="h-5 w-5" />
            </span>
            <p className="mt-3 font-display text-3xl font-extrabold">{formatNaira(withdrawnLifetime, false)}</p>
            <p className="text-sm text-slate-400">Withdrawn · lifetime</p>
          </div>
        </div>
      </div>

      {/* referral link */}
      <div className="dotted card mt-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
            <Share2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">Your referral link</p>
            <p className="text-sm text-slate-400">Earn a commission when friends activate a plan</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-extrabold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
            <Crown className="h-3.5 w-3.5" /> {planById(plan).name.toUpperCase()}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-2 dark:bg-white/5">
          <span className="flex-1 truncate pl-2 text-sm text-slate-500">{link}</span>
          <button onClick={copyRef} className="btn-primary shrink-0 px-4 py-2.5 text-sm">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Total", value: referrals.length, color: "text-slate-800 dark:text-white" },
            { label: "Activated", value: activated, color: "text-emerald-500" },
            { label: "Pending", value: pending, color: "text-amber-500" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-slate-50 py-3 dark:bg-white/5">
              <p className={cn("font-display text-2xl font-extrabold", s.color)}>{s.value}</p>
              <p className="text-xs font-semibold text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        <button onClick={() => nav("/sales")} className="btn mt-4 w-full border-2 border-slate-100 py-3.5 font-bold dark:border-white/10">
          <Users className="h-4 w-4" /> View affiliate dashboard
        </button>
      </div>

      {/* shortcut cards */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => nav("/earn")} className="card flex items-center gap-3 p-4 text-left transition active:scale-[0.98]">
          <MonitorSmartphone className="h-6 w-6 shrink-0 text-brand-600 dark:text-brand-300" />
          <div className="min-w-0">
            <p className="font-bold leading-tight">Ways to earn</p>
            <p className="text-xs text-slate-400">4 activities</p>
          </div>
        </button>
        <button onClick={() => nav("/leaderboard")} className="card flex items-center gap-3 p-4 text-left transition active:scale-[0.98]">
          <Trophy className="h-6 w-6 shrink-0 text-brand-600 dark:text-brand-300" />
          <div className="min-w-0">
            <p className="font-bold leading-tight">Star earners</p>
            <p className="text-xs text-slate-400">Top 10 this week</p>
          </div>
        </button>
      </div>

      {/* move to a higher plan */}
      <button onClick={() => nav("/packages")} className="mt-4 flex w-full items-center gap-4 overflow-hidden rounded-4xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-5 text-left text-white shadow-card">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500 text-slate-900"><Rocket className="h-6 w-6" /></span>
        <div className="flex-1">
          <p className="font-display text-lg font-bold">Move to a higher plan</p>
          <p className="text-sm text-white/60">Bigger rewards per session, task & referral — upgrade anytime</p>
        </div>
        <ChevronRight className="h-5 w-5 text-brand-400" />
      </button>

      {/* floating crown → Top Earner Club */}
      <button
        onClick={() => setTopClub(true)}
        className="fixed bottom-28 right-[max(16px,calc(50%-224px+16px))] z-30 grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-slate-900 shadow-glow transition active:scale-90"
        aria-label="Top Earner Club"
      >
        <Crown className="h-6 w-6" />
      </button>

      <Sheet open={topClub} onClose={() => setTopClub(false)}>
        <div className="-mx-5 -mb-8 overflow-hidden rounded-t-4xl bg-gradient-to-b from-[#2a1e05] via-ink-900 to-ink-950 px-6 pb-9 pt-2 text-center text-white">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-brand-400 ring-1 ring-brand-500/40">
            🔒 Top Earner Club 🔒
          </span>
          <div className="relative mx-auto mt-5 w-fit">
            <Crown className="absolute -top-4 left-1/2 h-8 w-8 -translate-x-1/2 text-brand-400" fill="currentColor" />
            <div className="grid h-32 w-32 place-items-center rounded-full bg-brand-50 ring-4 ring-brand-500/70">
              <Lock className="h-14 w-14 text-brand-600" />
            </div>
          </div>
          <h2 className="mt-5 font-display text-3xl font-extrabold">Become a Top Earner</h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-brand-400/80">Special design locked</p>
          <p className="mx-auto mt-3 max-w-xs text-sm text-white/70">
            Reach the Top 15 and unlock a premium gold flyer made just for you — with your name and your total.
          </p>
          <div className="mx-auto mt-5 max-w-xs rounded-2xl p-4 ring-2 ring-brand-500/50">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Your special flyer</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-brand-400">Locked</p>
          </div>
          <p className="mt-4 text-sm text-white/70">Refer more people to climb the leaderboard</p>
          <button onClick={() => { setTopClub(false); nav("/sales"); }} className="btn-primary mt-4 w-full py-4 text-lg">
            <Users className="h-5 w-5" /> Refer & climb
          </button>
          <p className="mt-4 font-display font-extrabold">Task<span className="text-brand-400">Earner</span> <span className="text-sm font-medium text-white/50">· your voice is currency</span></p>
        </div>
      </Sheet>
    </Layout>
  );
}
