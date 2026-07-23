import { useState } from "react";
import { Copy, Check, Share2, MessageCircle, Info, Users, Coins } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Drawer } from "@/components/Drawer";
import { useStore } from "@/store/useStore";
import { PLANS } from "@/lib/data";
import { formatNaira, timeAgo } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { planById } from "@/lib/data";
import { Menu } from "lucide-react";

export default function Sales() {
  const toast = useToast();
  const { username, sales, referrals, simulateReferral } = useStore();
  const [copied, setCopied] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const link = `https://voicearn.com/signup?ref=${username || "guest"}`;
  const activated = referrals.filter((r) => r.status === "activated").length;
  const pending = referrals.filter((r) => r.status === "pending").length;

  const copy = () => {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast("Referral link copied!");
  };

  return (
    <Layout>
      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => setDrawer(true)} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">Affiliate Program</h1>
          <p className="text-sm text-slate-400">Refer friends & earn commissions</p>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: referrals.length, color: "text-slate-800 dark:text-white" },
          { label: "Activated", value: activated, color: "text-emerald-500" },
          { label: "Pending", value: pending, color: "text-amber-500" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`font-display text-3xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs font-semibold text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* commission card */}
      <div className="mt-4 overflow-hidden rounded-4xl bg-gradient-to-br from-[#1c1230] via-[#2a1a44] to-[#0f0a18] p-6 text-white shadow-card">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-700">
          <Coins className="h-6 w-6" />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/50">Total Sales Commission</p>
        <p className="mt-1 font-display text-4xl font-extrabold">{formatNaira(sales)}</p>
        <p className="mt-1 text-sm text-white/60">Lifetime earned: {formatNaira(sales)}</p>
      </div>

      {/* referral link */}
      <div className="card mt-4 p-5">
        <p className="font-bold">Your referral link</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 p-2 dark:bg-white/5">
          <span className="flex-1 truncate pl-2 text-sm text-slate-500">{link}</span>
          <button onClick={copy} className="btn-primary shrink-0 px-4 py-2.5 text-sm">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={copy} className="btn-ghost py-3">
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button onClick={() => toast("Opening WhatsApp…", "info")} className="btn bg-emerald-500 py-3 text-white">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
        </div>
      </div>

      {/* how it works */}
      <div className="mt-4 rounded-3xl bg-brand-50 p-5 dark:bg-brand-500/10">
        <p className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-200">
          <Info className="h-5 w-5" /> How your commission is calculated
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          You earn a commission based on the plan your referral activates — from{" "}
          <b>{formatNaira(800, false)}</b> up to <b>{formatNaira(10000, false)}</b>. The bigger the plan they buy, the more you earn.
        </p>
      </div>

      {/* commission table */}
      <div className="card mt-4 p-5">
        <p className="mb-2 font-bold">Commission per plan activated</p>
        {PLANS.map((p, i) => (
          <div key={p.id} className={`flex items-center justify-between py-3 ${i < PLANS.length - 1 ? "border-b border-dashed border-slate-100 dark:border-white/5" : ""}`}>
            <span className="font-semibold">
              {p.name} <span className="text-sm text-slate-400">({formatNaira(p.price, false)})</span>
            </span>
            <span className="font-display text-lg font-extrabold text-emerald-500">{formatNaira(p.commission, false)}</span>
          </div>
        ))}
      </div>

      {/* referrals list */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Your referrals</h2>
          <button onClick={() => { simulateReferral(); toast("New referral activated a plan! 💰"); }} className="text-sm font-bold text-brand-600 dark:text-brand-300">
            + Simulate
          </button>
        </div>
        {referrals.length === 0 ? (
          <div className="card flex flex-col items-center p-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
              <Users className="h-8 w-8 text-brand-500" />
            </div>
            <p className="mt-3 text-slate-400">No referrals yet. Share your link to start earning!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft dark:bg-white/[0.04]">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-white">
                  {r.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-bold">{r.name}</p>
                  <p className="text-xs text-slate-400">Activated {planById(r.plan).name} · {timeAgo(r.ts)}</p>
                </div>
                <span className="font-bold text-emerald-500">+{formatNaira(planById(r.plan).commission, false)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
