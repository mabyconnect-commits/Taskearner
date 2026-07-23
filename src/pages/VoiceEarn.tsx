import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Check, Crown, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { planById, VOICE_SENTENCES } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type Phase = "idle" | "reading" | "done";

export default function VoiceEarn() {
  const nav = useNavigate();
  const toast = useToast();
  const { plan, earnActivity, cooldowns } = useStore();
  const p = planById(plan);

  const [phase, setPhase] = useState<Phase>("idle");
  const [earnedAmt, setEarnedAmt] = useState(p.perVoice);
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [wordIdx, setWordIdx] = useState(-1);
  const timer = useRef<number | null>(null);

  const sentences = VOICE_SENTENCES.slice(0, 4);
  const words = sentences[sentenceIdx]?.split(" ") ?? [];

  const cooldownLeft = Math.max(0, (cooldowns["voice"] ?? 0) - Date.now());
  const [, force] = useState(0);
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = window.setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (plan === "free") return <Locked />;

  const startReading = () => {
    setPhase("reading");
    setSentenceIdx(0);
    setWordIdx(-1);
    runSentence(0);
  };

  const runSentence = (sIdx: number) => {
    const w = sentences[sIdx].split(" ");
    let i = -1;
    if (timer.current) clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      i += 1;
      setWordIdx(i);
      if (i >= w.length - 1) {
        clearInterval(timer.current!);
        window.setTimeout(() => {
          if (sIdx + 1 < sentences.length) {
            setSentenceIdx(sIdx + 1);
            setWordIdx(-1);
            runSentence(sIdx + 1);
          } else {
            finish();
          }
        }, 500);
      }
    }, 380);
  };

  const finish = async () => {
    const res = await earnActivity("voice");
    if (!res.ok) {
      toast(res.msg, "error");
      setPhase("idle");
      return;
    }
    setEarnedAmt(res.amount ?? p.perVoice);
    setPhase("done");
    toast(`You earned ${formatNaira(res.amount ?? p.perVoice)}! 🎙️`);
  };

  const progress = phase === "reading" ? ((sentenceIdx + (wordIdx + 1) / Math.max(words.length, 1)) / sentences.length) * 100 : phase === "done" ? 100 : 0;

  return (
    <Layout hideNav>
      <PageHeader title="Voice Earn" subtitle={`Read aloud · ${formatNaira(p.perVoice)} per session`} to="/earn" />

      {/* progress */}
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <motion.div className="h-full rounded-full bg-brand-500" animate={{ width: `${progress}%` }} />
      </div>

      {phase !== "done" && (
        <div className="card mb-6 min-h-[220px] p-6">
          <p className="mb-3 text-sm font-semibold text-slate-400">
            {phase === "idle" ? "Tap the mic and read every word aloud" : `Sentence ${sentenceIdx + 1} of ${sentences.length}`}
          </p>
          <p className="font-display text-2xl font-bold leading-relaxed">
            {words.map((w, i) => (
              <span
                key={i}
                className={cn(
                  "transition-colors",
                  phase === "reading" && i <= wordIdx ? "text-brand-500" : "text-slate-800 dark:text-slate-100",
                  phase === "reading" && i === wordIdx && "underline decoration-brand-400 decoration-4 underline-offset-4",
                )}
              >
                {w}{" "}
              </span>
            ))}
          </p>
        </div>
      )}

      {phase === "done" ? (
        <div className="card flex flex-col items-center p-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
            <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
          </motion.div>
          <h2 className="mt-4 font-display text-2xl font-extrabold">Session complete!</h2>
          <p className="mt-1 text-slate-400">Nicely read. Your reward has been added.</p>
          <p className="mt-4 font-display text-4xl font-extrabold text-emerald-500">+{formatNaira(earnedAmt)}</p>
          <div className="mt-6 flex w-full gap-3">
            <button onClick={() => nav("/earn")} className="btn-ghost flex-1 py-3.5">Back to Earn</button>
            <button onClick={() => nav("/wallet")} className="btn-primary flex-1 py-3.5">Withdraw</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <button
            onClick={phase === "idle" ? startReading : undefined}
            disabled={phase === "reading" || cooldownLeft > 0}
            className="relative grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-glow transition active:scale-95 disabled:opacity-70"
          >
            {(phase === "reading" || cooldownLeft > 0) && (
              <>
                <span className="absolute inset-0 animate-pulseRing rounded-full ring-4 ring-amber-400/60" />
                <span className="absolute inset-0 animate-pulseRing rounded-full ring-4 ring-amber-400/40 [animation-delay:0.6s]" />
              </>
            )}
            {cooldownLeft > 0 ? <Clock className="h-14 w-14" /> : <Mic className="h-14 w-14" />}
          </button>
          <p className="mt-5 font-semibold text-slate-500">
            {cooldownLeft > 0
              ? `Cooldown · ${Math.ceil(cooldownLeft / 1000)}s`
              : phase === "reading"
                ? "Listening… keep reading"
                : "Tap to start reading"}
          </p>
        </div>
      )}
    </Layout>
  );
}

function Locked() {
  const nav = useNavigate();
  return (
    <Layout hideNav>
      <PageHeader title="Voice Earn" to="/earn" />
      <div className="card mt-10 flex flex-col items-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
          <Crown className="h-10 w-10 text-brand-500" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold">Activate a plan first</h2>
        <p className="mt-1 text-slate-400">Voice Earn is unlocked once you activate any lifetime plan.</p>
        <button onClick={() => nav("/packages")} className="btn-primary mt-6 w-full py-4">View plans</button>
      </div>
    </Layout>
  );
}
