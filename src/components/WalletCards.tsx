import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, ArrowUp, Rocket, Plus, TrendingUp } from "lucide-react";
import { useStore } from "@/store/useStore";
import { planById } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/cn";

export function WalletCards() {
  const nav = useNavigate();
  const { engagement, sales, deposit, username, plan } = useStore();
  const [active, setActive] = useState(0);
  const planName = planById(plan).name;

  const cards = [
    {
      key: "total",
      label: "Total balance",
      value: engagement + sales + deposit,
      gradient: "from-brand-500 via-brand-600 to-brand-800",
      icon: <Mic className="h-6 w-6 text-white" />,
      iconWrap: "bg-gradient-to-br from-amber-400 to-amber-500 ring-amber-300/50 shadow-lg",
      primary: { label: "Withdraw", icon: <ArrowUp className="h-4 w-4" />, onClick: () => nav("/wallet") },
      secondary: { label: "Upgrade", icon: <Rocket className="h-4 w-4" />, onClick: () => nav("/packages") },
      sub: `@${username || "guest"} · ${planName}`,
    },
    {
      key: "engagement",
      label: "Engagement balance",
      value: engagement,
      gradient: "from-brand-500 via-brand-600 to-brand-800",
      icon: <Mic className="h-6 w-6" />,
      iconWrap: "",
      primary: { label: "Withdraw", icon: <ArrowUp className="h-4 w-4" />, onClick: () => nav("/wallet") },
      secondary: { label: "Upgrade", icon: <Rocket className="h-4 w-4" />, onClick: () => nav("/packages") },
      sub: `@${username || "guest"} · ${planName}`,
    },
    {
      key: "sales",
      label: "Sales commission",
      value: sales,
      gradient: "from-indigo-500 via-violet-600 to-brand-800",
      icon: <TrendingUp className="h-6 w-6" />,
      iconWrap: "",
      primary: { label: "Withdraw", icon: <ArrowUp className="h-4 w-4" />, onClick: () => nav("/wallet") },
      secondary: { label: "Refer", icon: <Rocket className="h-4 w-4" />, onClick: () => nav("/sales") },
      sub: "Affiliate earnings",
    },
    {
      key: "deposit",
      label: "Deposit wallet",
      value: deposit,
      gradient: "from-[#1c1230] via-[#241a3a] to-[#0f0a18]",
      icon: <Plus className="h-6 w-6" />,
      iconWrap: "",
      primary: { label: "Fund", icon: <Plus className="h-4 w-4" />, onClick: () => nav("/deposit") },
      secondary: { label: "Upgrade", icon: <Rocket className="h-4 w-4" />, onClick: () => nav("/packages") },
      sub: "For activating & upgrading plans",
    },
  ];

  return (
    <div>
      <div
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / (el.clientWidth * 0.86)));
        }}
      >
        {cards.map((c) => (
          <div
            key={c.key}
            className={cn(
              "relative w-[86%] shrink-0 snap-center overflow-hidden rounded-4xl bg-gradient-to-br p-6 text-white shadow-card",
              c.gradient,
            )}
          >
            <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute right-10 top-16 h-24 w-24 rounded-full bg-white/5" />

            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/70">{c.label}</p>
                <p className="mt-1 font-display text-[40px] font-extrabold leading-none tracking-tight">
                  {formatNaira(c.value)}
                </p>
                <p className="mt-2 text-sm text-white/60">{c.sub}</p>
              </div>
              <div className={cn(
                "grid h-12 w-12 place-items-center rounded-2xl ring-1 backdrop-blur",
                c.iconWrap || "bg-white/15 ring-white/20",
              )}>
                {c.icon}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={c.primary.onClick} className="btn flex-1 bg-white py-3 text-brand-700">
                {c.primary.icon} {c.primary.label}
              </button>
              <button onClick={c.secondary.onClick} className="btn flex-1 bg-white/15 py-3 text-white ring-1 ring-white/20">
                {c.secondary.icon} {c.secondary.label}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {cards.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === active ? "w-6 bg-brand-500" : "w-1.5 bg-slate-300 dark:bg-white/20",
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-center text-sm text-slate-400">↔ swipe the cards to switch wallets</p>
    </div>
  );
}
