import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Camera, Crown, User as UserIcon, Building2, Share2, Lock, Receipt, Headphones, ChevronRight, Check, Shield,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Sheet } from "@/components/ui/Sheet";
import { useStore } from "@/store/useStore";
import { planById } from "@/lib/data";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export default function Profile() {
  const nav = useNavigate();
  const toast = useToast();
  const { name, username, email, phone, plan, bank, socialLinked, isAdmin, linkSocial, updateProfile, logout } = useStore();
  const [editSheet, setEditSheet] = useState(false);
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const [e, setE] = useState(email);

  const steps = [Boolean(name), Boolean(bank), socialLinked];
  const done = steps.filter(Boolean).length;
  const planName = planById(plan).name;

  const rows = [
    ...(isAdmin
      ? [{ icon: Shield, title: "Admin Dashboard", sub: "Activities, tasks, payouts, posts", onClick: () => nav("/admin"), badge: { text: "Admin", ok: true } as const }]
      : []),
    { icon: UserIcon, title: "Personal Info", sub: "Name, phone, email", onClick: () => setEditSheet(true), badge: null },
    { icon: Building2, title: "Bank Account", sub: "Add your payout bank", onClick: () => nav("/wallet"), badge: bank ? { text: "Linked", ok: true } : { text: "Required", ok: false } },
    { icon: Share2, title: "Social Accounts", sub: "For sponsored post tasks", onClick: async () => { if (!socialLinked) { const r = await linkSocial(); toast(r.msg, r.ok ? "success" : "error"); } }, badge: socialLinked ? { text: "Linked", ok: true } : { text: "Link", ok: false } },
    { icon: Lock, title: "Password & Security", sub: "Change your password", onClick: () => nav("/security"), badge: null },
    { icon: Receipt, title: "Transaction History", sub: "All your earnings & payouts", onClick: () => nav("/transactions"), badge: null },
    { icon: Headphones, title: "Help & Support", sub: "Contact us", onClick: () => toast("Support: support@taskearner.africa", "info"), badge: null },
  ];

  return (
    <Layout>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">My Profile</h1>
        <button onClick={() => { logout(); nav("/"); }} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-rose-500 dark:bg-white/10">
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* profile card */}
      <div className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-6 text-center text-white shadow-card">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-2xl" />
        <div className="relative mx-auto w-fit">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-ink-800 to-ink-950 text-4xl font-extrabold ring-4 ring-amber-300/60">
            {(name || "T")[0].toUpperCase()}
          </div>
          <button className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-white text-brand-700">
            <Camera className="h-4 w-4" />
          </button>
        </div>
        <h2 className="mt-3 font-display text-2xl font-extrabold">{name || "New Earner"}</h2>
        <p className="text-white/60">@{username || "guest"}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-extrabold text-brand-800">
          <Crown className="h-4 w-4" /> {planName.toUpperCase()} MEMBER
        </span>
      </div>

      {/* setup progress */}
      <div className="card mt-5 p-5">
        <div className="flex items-center justify-between">
          <p className="font-bold">Finish setting up</p>
          <span className="font-display font-extrabold text-brand-600 dark:text-brand-300">{done}/3</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(done / 3) * 100}%` }} />
        </div>
      </div>

      {/* rows */}
      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <button key={r.title} onClick={r.onClick} className="flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-soft transition active:scale-[0.98] dark:bg-white/[0.04]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
              <r.icon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{r.title}</p>
              <p className="truncate text-sm text-slate-400">{r.sub}</p>
            </div>
            {r.badge ? (
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold",
                r.badge.ok ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300")}>
                {r.badge.text}
              </span>
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-300" />
            )}
          </button>
        ))}
      </div>

      <button onClick={() => { logout(); nav("/"); }} className="btn mt-5 w-full bg-rose-50 py-4 text-rose-600 dark:bg-rose-500/10">
        <LogOut className="h-5 w-5" /> Log Out
      </button>

      <Sheet open={editSheet} onClose={() => setEditSheet(false)} title="Personal Info">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">Full name</span>
            <input value={n} onChange={(ev) => setN(ev.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">Phone</span>
            <input value={p} onChange={(ev) => setP(ev.target.value.replace(/[^\d+]/g, ""))} className="input" placeholder="080..." />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">Email</span>
            <input value={e} onChange={(ev) => setE(ev.target.value)} className="input" />
          </label>
          <button onClick={async () => { const r = await updateProfile({ name: n, phone: p, email: e }); toast(r.msg, r.ok ? "success" : "error"); if (r.ok) setEditSheet(false); }} className="btn-primary w-full py-4">
            <Check className="h-5 w-5" /> Save changes
          </button>
        </div>
      </Sheet>
    </Layout>
  );
}
