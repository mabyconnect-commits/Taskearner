import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function Landing() {
  const authed = useStore((s) => s.authed);
  if (authed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative mx-auto flex min-h-full max-w-md flex-col overflow-hidden bg-gradient-to-b from-brand-600 via-brand-700 to-[#2b0644] px-6 pb-10 pt-16 text-white">
      {/* glow blobs */}
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-brand-400/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-40 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl" />

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14 }}
        className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white/15 ring-1 ring-white/25 backdrop-blur"
      >
        <span className="absolute inset-0 animate-pulseRing rounded-3xl ring-2 ring-white/40" />
        <Mic className="h-10 w-10" />
      </motion.div>

      <h1 className="mt-8 text-center font-display text-5xl font-extrabold leading-[1.05]">
        Turn your <span className="text-amber-300">voice</span> into income.
      </h1>
      <p className="mt-4 text-center text-lg text-white/75">
        Read, play, and share to earn real cash. Pay once, earn forever — the smartest way to make money online.
      </p>

      <div className="mt-8 space-y-3">
        {[
          { icon: Zap, t: "Instant activation", d: "Activate a lifetime plan and start earning today." },
          { icon: Sparkles, t: "Multiple ways to earn", d: "Voice reads, word games, tasks & sponsored posts." },
          { icon: ShieldCheck, t: "Fast, secure payouts", d: "Withdraw straight to your bank account." },
        ].map((f, i) => (
          <motion.div
            key={f.t}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur"
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15">
              <f.icon className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <p className="font-bold">{f.t}</p>
              <p className="text-sm text-white/70">{f.d}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-auto space-y-3 pt-10">
        <Link to="/auth" className="btn w-full bg-white py-4 text-lg text-brand-700 shadow-xl">
          Get started — it's free
        </Link>
        <Link to="/auth?mode=login" className="btn w-full bg-white/10 py-4 text-lg text-white ring-1 ring-white/20">
          I already have an account
        </Link>
      </div>
    </div>
  );
}
