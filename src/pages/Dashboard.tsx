import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Bell, Smartphone, Wifi, Zap, Tv, Crown, X, Mic, Gamepad2, CheckCircle2, Megaphone } from "lucide-react";
import { useStore } from "@/store/useStore";
import { greeting } from "@/lib/format";
import { Layout } from "@/components/Layout";
import { Drawer } from "@/components/Drawer";
import { WalletCards } from "@/components/WalletCards";
import { cn } from "@/lib/cn";

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
  const { name } = useStore();
  const [drawer, setDrawer] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const first = name?.split(" ")[0] || "Star";

  return (
    <Layout>
      <Drawer open={drawer} onClose={() => setDrawer(false)} />

      {/* top bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => setDrawer(true)} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
        <button onClick={() => nav("/profile")} className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-white">
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
            Do not place withdrawals using PalmPay as your bank.
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

      {/* floating upgrade */}
      <button
        onClick={() => nav("/packages")}
        className="fixed bottom-28 right-[max(16px,calc(50%-224px+16px))] z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-glow transition active:scale-90"
        aria-label="Upgrade plan"
      >
        <Crown className="h-6 w-6" />
      </button>
    </Layout>
  );
}
