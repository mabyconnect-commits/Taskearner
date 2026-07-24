import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MousePointerClick, Wallet, Banknote, Globe } from "lucide-react";
import { useStore } from "@/store/useStore";
import { LogoMark } from "@/components/Logo";

const steps = [
  { icon: MousePointerClick, t: "Choose", d: "Pick a voice recording task or a simple digital task from your dashboard." },
  { icon: Wallet, t: "Earn", d: "Complete it, submit it, and watch your wallet balance grow." },
  { icon: Banknote, t: "Cashout", d: "Withdraw your money straight to your bank account." },
];

export default function Landing() {
  const authed = useStore((s) => s.authed);
  if (authed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative mx-auto flex min-h-full max-w-md flex-col overflow-hidden bg-gradient-to-b from-ink-900 via-ink-950 to-black px-6 pb-10 pt-14 text-white">
      {/* glow blobs */}
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-44 h-56 w-56 rounded-full bg-brand-400/15 blur-3xl" />

      <div className="relative mb-8 flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20">
          <Globe className="h-3.5 w-3.5 text-brand-400" /> Made for Africa
        </span>
      </div>

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14 }}
        className="relative mx-auto"
      >
        <span className="absolute inset-0 animate-pulseRing rounded-full ring-2 ring-brand-500/40" />
        <LogoMark className="h-24 w-24 drop-shadow-[0_8px_30px_rgba(245,197,24,0.35)]" />
      </motion.div>

      <p className="mt-5 text-center font-sans text-2xl font-extrabold tracking-tight">
        Task<span className="text-brand-400">Earner</span>
        <span className="ml-2 rounded-md bg-brand-500 px-1.5 py-0.5 align-middle text-xs font-extrabold uppercase text-slate-900">Africa</span>
      </p>

      <h1 className="mt-4 text-center font-display text-[42px] font-extrabold leading-[1.05]">
        Your voice is <span className="text-brand-400">currency.</span>
      </h1>
      <p className="mt-4 text-center text-lg text-white/80">
        Task Earner Africa lets everyday Africans turn their voice — and simple daily tasks — into pure cash. 💸
        If you can talk, read a short script, or tap a few tasks, you get paid.
      </p>

      {/* how it works */}
      <div className="mt-8 space-y-3">
        <p className="text-center text-sm font-bold uppercase tracking-widest text-white/50">How it works</p>
        {steps.map((s, i) => (
          <motion.div
            key={s.t}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur"
          >
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
              <s.icon className="h-5 w-5 text-brand-400" />
              <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-[11px] font-extrabold text-slate-900">
                {i + 1}
              </span>
            </div>
            <div>
              <p className="font-bold">{s.t}</p>
              <p className="text-sm text-white/70">{s.d}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-auto space-y-3 pt-9">
        <Link to="/auth" className="btn w-full bg-brand-500 py-4 text-lg text-slate-900 shadow-glow">
          Start earning — it's free
        </Link>
        <Link to="/auth?mode=login" className="btn w-full bg-white/10 py-4 text-lg text-white ring-1 ring-white/20">
          I already have an account
        </Link>
        <p className="pt-1 text-center text-sm text-white/60">Turn your talk into alerts. 🎙️🌍</p>
      </div>
    </div>
  );
}
