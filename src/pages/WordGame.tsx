import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, Check, Crown, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { planById, WORD_GAME_WORDS } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const ROUNDS = 3;
const TIME = 10;

export default function WordGame() {
  const nav = useNavigate();
  const toast = useToast();
  const { plan, earnActivity } = useStore();
  const p = planById(plan);

  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [round, setRound] = useState(0);
  const [time, setTime] = useState(TIME);
  const [earned, setEarned] = useState(0);
  const [words] = useState(() => [...WORD_GAME_WORDS].sort(() => Math.random() - 0.5).slice(0, ROUNDS));
  const tick = useRef<number | null>(null);
  const correct = useRef(0);

  useEffect(() => () => { if (tick.current) clearInterval(tick.current); }, []);

  if (plan === "free") return <Locked />;

  const startRound = (r: number) => {
    setRound(r);
    setTime(TIME);
    if (tick.current) clearInterval(tick.current);
    tick.current = window.setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          clearInterval(tick.current!);
          next(r, false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const start = () => {
    setPhase("playing");
    setEarned(0);
    correct.current = 0;
    startRound(0);
  };

  const speak = () => {
    try {
      const u = new SpeechSynthesisUtterance(words[round]);
      u.rate = 0.85;
      window.speechSynthesis?.speak(u);
    } catch { /* ignore */ }
  };

  const next = async (r: number, success: boolean) => {
    if (tick.current) clearInterval(tick.current);
    if (success) {
      correct.current += 1;
      toast(`Correct! +${formatNaira(p.perWord)}`);
    } else {
      toast("Time's up on that word!", "error");
    }
    if (r + 1 < ROUNDS) {
      startRound(r + 1);
    } else {
      setPhase("done");
      if (correct.current > 0) {
        const res = await earnActivity("word", undefined, correct.current);
        setEarned(res.ok ? res.amount ?? p.perWord * correct.current : 0);
        if (!res.ok) toast(res.msg, "error");
      } else {
        setEarned(0);
      }
    }
  };

  return (
    <Layout hideNav>
      <PageHeader title="Word Game" subtitle={`Pronounce within 10s · ${formatNaira(p.perWord)}/word`} to="/earn" />

      {phase === "idle" && (
        <div className="card flex flex-col items-center p-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-emerald-100 dark:bg-emerald-500/20">
            <Volume2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-extrabold">Beat the clock</h2>
          <p className="mt-1 text-slate-400">
            You'll get {ROUNDS} long words. Pronounce each one out loud within {TIME} seconds and tap “I said it”.
          </p>
          <button onClick={start} className="btn-primary mt-6 w-full py-4 text-lg">Start game</button>
        </div>
      )}

      {phase === "playing" && (
        <>
          <div className="mb-4 flex items-center justify-between text-sm font-semibold text-slate-400">
            <span>Word {round + 1} of {ROUNDS}</span>
            <span>Earned {formatNaira(earned)}</span>
          </div>

          {/* timer ring */}
          <div className="mx-auto my-6 grid h-40 w-40 place-items-center">
            <svg className="absolute h-40 w-40 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" className="fill-none stroke-slate-100 dark:stroke-white/10" strokeWidth="8" />
              <motion.circle
                cx="50" cy="50" r="45"
                className={cn("fill-none", time <= 3 ? "stroke-rose-500" : "stroke-emerald-500")}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 45}
                animate={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - time / TIME) }}
                transition={{ ease: "linear", duration: 1 }}
              />
            </svg>
            <span className={cn("font-display text-5xl font-extrabold", time <= 3 ? "text-rose-500" : "text-slate-800 dark:text-white")}>
              {time}
            </span>
          </div>

          <div className="card p-6 text-center">
            <p className="text-sm font-semibold text-slate-400">Pronounce this word</p>
            <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-600 dark:text-brand-300">
              {words[round]}
            </p>
            <button onClick={speak} className="btn-ghost mx-auto mt-4 px-4 py-2 text-sm">
              <Volume2 className="h-4 w-4" /> Hear it
            </button>
          </div>

          <button onClick={() => next(round, true)} className="btn-primary mt-6 w-full py-4 text-lg">
            <Check className="h-5 w-5" /> I said it
          </button>
        </>
      )}

      {phase === "done" && (
        <div className="card flex flex-col items-center p-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
            <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
          </motion.div>
          <h2 className="mt-4 font-display text-2xl font-extrabold">Game over!</h2>
          <p className="mt-1 text-slate-400">Great pronunciation. Here's what you banked:</p>
          <p className="mt-4 font-display text-4xl font-extrabold text-emerald-500">+{formatNaira(earned)}</p>
          <div className="mt-6 flex w-full gap-3">
            <button onClick={() => nav("/earn")} className="btn-ghost flex-1 py-3.5">
              <RotateCcw className="h-4 w-4" /> Done
            </button>
            <button onClick={() => nav("/wallet")} className="btn-primary flex-1 py-3.5">Withdraw</button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function Locked() {
  const nav = useNavigate();
  return (
    <Layout hideNav>
      <PageHeader title="Word Game" to="/earn" />
      <div className="card mt-10 flex flex-col items-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
          <Crown className="h-10 w-10 text-brand-500" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold">Activate a plan first</h2>
        <p className="mt-1 text-slate-400">The Word Game unlocks with any lifetime plan.</p>
        <button onClick={() => nav("/packages")} className="btn-primary mt-6 w-full py-4">View plans</button>
      </div>
    </Layout>
  );
}
