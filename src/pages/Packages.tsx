import { useNavigate } from "react-router-dom";
import { Mic, Gamepad2, Megaphone, CheckCircle2, Infinity as Inf, Plus, Crown, Check, Users, Rocket, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { PLANS, planById, planDailyMax } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export default function Packages() {
  const nav = useNavigate();
  const toast = useToast();
  const { deposit, plan, planActivated, activatePlan } = useStore();
  const current = planById(plan);
  const freePlan = planById("free");
  const freeActive = plan === "free" && planActivated;
  const onPaid = plan !== "free";

  const onActivate = async (id: typeof PLANS[number]["id"]) => {
    const res = await activatePlan(id);
    toast(res.msg, res.ok ? "success" : "error");
  };

  return (
    <Layout>
      <PageHeader title="Plans & Pricing" subtitle="Activate instantly with your deposit balance" to="/dashboard" />

      {/* deposit banner */}
      <div className="overflow-hidden rounded-4xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-6 text-white shadow-card">
        <p className="text-sm text-white/60">Your deposit balance</p>
        <p className="mt-1 font-display text-4xl font-extrabold">{formatNaira(deposit)}</p>
        <button onClick={() => nav("/deposit")} className="btn mt-4 bg-white px-5 py-3 text-brand-700">
          <Plus className="h-4 w-4" /> Fund wallet
        </button>
      </div>

      <p className="my-5 text-center text-slate-500 dark:text-slate-400">
        Every plan is a <b className="text-slate-800 dark:text-white">one-time Lifetime activation</b> — pay once, earn forever.
      </p>

      <div className="space-y-5">
        {/* Free plan — must be activated (₦0), no longer auto-on */}
        <div className={cn("overflow-hidden rounded-4xl shadow-card", freeActive && "ring-2 ring-emerald-400")}>
          <div className="relative bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-6 text-white">
            {freeActive && (
              <span className="absolute right-5 top-5 rounded-full bg-emerald-400 px-3 py-1 text-xs font-extrabold text-emerald-950">ACTIVE</span>
            )}
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Mic className="h-5 w-5" /></div>
              <span className="text-lg font-bold">Free</span>
            </div>
            <p className="mt-3 font-display text-4xl font-extrabold">{formatNaira(0, false)}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
              <Check className="h-4 w-4" /> No payment needed
            </span>
          </div>
          <div className="bg-white p-5 dark:bg-white/[0.04]">
            <Row icon={<Mic className="h-4 w-4" />} color="text-brand-500" amount={freePlan.perVoice} label="per Voice Earn session" />
            <Row icon={<Gamepad2 className="h-4 w-4" />} color="text-brand-500" amount={freePlan.perWord} label="per Word Game" />
            <Row icon={<Megaphone className="h-4 w-4" />} color="text-amber-500" amount={freePlan.perPost} label="per Sponsored Post" />
            <Row icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-500" amount={freePlan.perTask} label="per Task" last />
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-brand-500 px-4 py-3.5 text-slate-900 shadow-soft">
              <p className="text-sm font-bold">Total daily earning</p>
              <span className="font-display text-2xl font-extrabold">{formatNaira(planDailyMax(freePlan), false)}</span>
            </div>
            <button
              onClick={() => onActivate("free")}
              disabled={freeActive || onPaid}
              className={cn("mt-4 w-full py-4 text-lg", freeActive ? "btn bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "btn-primary")}
            >
              {freeActive ? (<><Check className="h-5 w-5" /> Active plan</>) : onPaid ? "You're on a paid plan" : (<><Rocket className="h-5 w-5" /> Activate Free</>)}
            </button>
          </div>
        </div>

        {PLANS.map((p) => {
          const isCurrent = p.id === plan;
          const cost = p.price - (plan === "free" ? 0 : current.price);
          const isUpgrade = plan !== "free" && p.price > current.price;
          const affordable = deposit >= cost;
          const lowerTier = plan !== "free" && p.price <= current.price && !isCurrent;

          return (
            <div key={p.id} className={cn("overflow-hidden rounded-4xl shadow-card", p.popular && "ring-2 ring-brand-400")}>
              {/* header */}
              <div className="relative bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-6 text-white">
                {p.popular && (
                  <span className="absolute right-5 top-5 rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-brand-900">
                    ⭐ POPULAR
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute right-5 top-5 rounded-full bg-emerald-400 px-3 py-1 text-xs font-extrabold text-emerald-950">
                    ACTIVE
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Mic className="h-5 w-5" /></div>
                  <span className="text-lg font-bold">{p.name}</span>
                </div>
                <p className="mt-3 font-display text-4xl font-extrabold">{formatNaira(p.price, false)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                    <Inf className="h-4 w-4" /> Lifetime access
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/25 px-3 py-1 text-sm font-semibold text-brand-300">
                    <ShieldCheck className="h-4 w-4" /> Trust {p.trustScore}
                  </span>
                </div>
              </div>

              {/* body */}
              <div className="bg-white p-5 dark:bg-white/[0.04]">
                <Row icon={<Mic className="h-4 w-4" />} color="text-brand-500" amount={p.perVoice} label="per Voice Earn session" />
                <Row icon={<Gamepad2 className="h-4 w-4" />} color="text-brand-500" amount={p.perWord} label="per Word Game" />
                <Row icon={<Megaphone className="h-4 w-4" />} color="text-amber-500" amount={p.perPost} label="per Sponsored Post" />
                <Row icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-500" amount={p.perTask} label="per Task" />
                <Row icon={<Users className="h-4 w-4" />} color="text-indigo-500" amount={p.commission} label="per activated Sale" last />

                {/* Total daily earning = one of each activity per day (Voice +
                    Word + Sponsored Post + Task). Referral commission is not a
                    daily activity, so it's excluded. */}
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-brand-500 px-4 py-3.5 text-slate-900 shadow-soft">
                  <div>
                    <p className="text-sm font-bold">Total daily earning</p>
                    <p className="text-[11px] font-semibold text-slate-900/60">Voice + Word + Post + Task, once each</p>
                  </div>
                  <span className="font-display text-2xl font-extrabold">{formatNaira(planDailyMax(p), false)}</span>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-white/5">
                  <span className="font-semibold text-slate-500">Min. engagement withdrawal</span>
                  <span className="font-display font-extrabold">{formatNaira(p.minWithdraw, false)}</span>
                </div>

                <button
                  onClick={() => onActivate(p.id)}
                  disabled={isCurrent || lowerTier}
                  className={cn(
                    "mt-4 w-full py-4 text-lg",
                    isCurrent ? "btn bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "btn-primary",
                  )}
                >
                  {isCurrent ? (
                    <><Check className="h-5 w-5" /> Active plan</>
                  ) : lowerTier ? (
                    "Lower than current"
                  ) : (
                    <><Crown className="h-5 w-5" /> {isUpgrade ? `Upgrade for ${formatNaira(cost, false)}` : `Activate · ${formatNaira(p.price, false)}`}</>
                  )}
                </button>
                {!isCurrent && !lowerTier && !affordable && (
                  <p className="mt-2 text-center text-sm font-semibold text-rose-500">
                    Fund {formatNaira(cost - deposit, false)} more to activate
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}

function Row({ icon, color, amount, label, last }: { icon: React.ReactNode; color: string; amount: number; label: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 py-3", !last && "border-b border-dashed border-slate-100 dark:border-white/5")}>
      <span className={cn("grid h-8 w-8 place-items-center rounded-lg bg-slate-100 dark:bg-white/10", color)}>{icon}</span>
      <span className="font-display text-lg font-extrabold">{formatNaira(amount, false)}</span>
      <span className="text-slate-400">{label}</span>
    </div>
  );
}
