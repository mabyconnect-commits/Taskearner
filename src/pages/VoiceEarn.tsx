import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Check, Play, HelpCircle, Square, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useStore } from "@/store/useStore";
import { ActivateGate } from "@/components/ActivateGate";
import { planById, VOICE_LANGS, VoiceLang } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { useSpeech, sentenceCoverage, normalize } from "@/lib/speech";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type Phase = "intro" | "reading" | "done";

export default function VoiceEarn() {
  const nav = useNavigate();
  const toast = useToast();
  const { plan, planActivated, earnActivity } = useStore();
  const p = planById(plan);

  const [phase, setPhase] = useState<Phase>("intro");
  const [langSheet, setLangSheet] = useState(false);
  const [lang, setLang] = useState<VoiceLang>(VOICE_LANGS[0]);
  const [autoStart, setAutoStart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [earned, setEarned] = useState(p.perVoice);

  const sentence = useMemo(() => lang.sentences[Math.floor(Math.random() * lang.sentences.length)], [lang, phase === "reading"]);
  const words = sentence.split(" ");
  const { supported, listening, transcript, start, stop } = useSpeech(lang.code);

  const coverage = sentenceCoverage(transcript, sentence);
  const spokenNorm = normalize(transcript);

  // auto-complete when they've clearly read it
  useEffect(() => {
    if (phase === "reading" && coverage >= 0.7) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverage, phase]);

  if (!planActivated) return <ActivateGate title="Voice Earn" />;


  const beginReading = () => {
    setLangSheet(false);
    setPhase("reading");
    if (autoStart && supported) setTimeout(start, 350);
  };

  const finish = async () => {
    if (busy) return;
    stop();
    setBusy(true);
    const res = await earnActivity("voice");
    setBusy(false);
    if (!res.ok) {
      toast(res.msg, "error");
      return;
    }
    setEarned(res.amount ?? p.perVoice);
    setPhase("done");
    toast(`You earned ${formatNaira(res.amount ?? p.perVoice)}! 🎙️`);
  };

  return (
    <Layout hideNav>
      <PageHeader
        title="Voice Earn"
        subtitle={`Earn ${formatNaira(p.perVoice)} today`}
        to="/earn"
        right={
          <button onClick={() => toast("Tap the mic, allow microphone access, then read aloud.", "info")} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
            <HelpCircle className="h-5 w-5" />
          </button>
        }
      />

      {phase === "intro" && (
        <>
          <div className="card dotted flex flex-col items-center p-8 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
              <Mic className="h-10 w-10 text-brand-600 dark:text-brand-300" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-extrabold">Voice Earn</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-300">
              Read one short sentence out loud, clearly. Get it right to earn{" "}
              <span className="font-bold text-emerald-500">{formatNaira(p.perVoice)}</span>.
            </p>
            <p className="mt-2 text-sm text-slate-400">No timer — go at your own pace. Pick one language; finishing it completes your Voice Earn for the day.</p>
          </div>

          <button onClick={() => setLangSheet(true)} className="btn-primary mt-5 w-full py-4 text-lg">
            <Play className="h-5 w-5" /> Start Session
          </button>

          <div className="mt-4 flex items-center gap-4 rounded-3xl bg-white p-4 shadow-soft dark:bg-white/[0.04]">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500 text-slate-900"><Mic className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="font-bold">Auto-start microphone</p>
              <p className="text-sm text-slate-400">Start listening automatically each round</p>
            </div>
            <button onClick={() => setAutoStart((v) => !v)} className={cn("relative h-7 w-12 rounded-full transition", autoStart ? "bg-brand-500" : "bg-slate-300 dark:bg-white/20")}>
              <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all", autoStart ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>

          {!supported && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-center text-sm font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Your browser can't access speech recognition — you can still complete the session by tapping “I read it”.
            </p>
          )}
        </>
      )}

      {phase === "reading" && (
        <>
          <div className="card p-6">
            <p className="text-center text-sm font-bold uppercase tracking-widest text-slate-400">Read this aloud</p>
            <p className="mt-4 text-center font-display text-2xl font-extrabold leading-relaxed">
              {words.map((w, i) => {
                const hit = spokenNorm.split(" ").some((x) => normalize(w) && (x === normalize(w) || (x && normalize(w).startsWith(x) && x.length > 2)));
                return (
                  <span key={i} className={cn("transition-colors", hit ? "text-brand-600 dark:text-brand-400" : "text-slate-800 dark:text-slate-100")}>
                    {w}{" "}
                  </span>
                );
              })}
            </p>

            <div className="mt-6 flex flex-col items-center">
              <button
                onClick={listening ? stop : start}
                disabled={!supported}
                className={cn(
                  "relative grid h-24 w-24 place-items-center rounded-full text-white shadow-glow transition active:scale-95",
                  listening ? "bg-rose-500" : "bg-brand-500 text-slate-900",
                )}
              >
                {listening && <span className="absolute inset-0 animate-pulseRing rounded-full ring-4 ring-rose-400/50" />}
                {listening ? <Square className="h-9 w-9" /> : <Mic className="h-10 w-10" />}
              </button>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                {!supported ? "Speech not available on this browser" : listening ? "Listening… read the sentence" : "Tap the mic and read it aloud"}
              </p>
              {supported && (
                <div className="mt-2 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, Math.round(coverage * 100))}%` }} />
                </div>
              )}
            </div>
          </div>

          <button onClick={finish} disabled={busy} className="btn-primary mt-5 w-full py-4 text-lg">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> {supported ? "Done — check my voice" : "I read it"}</>}
          </button>
        </>
      )}

      {phase === "done" && (
        <div className="card flex flex-col items-center p-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
            <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
          </motion.div>
          <h2 className="mt-4 font-display text-2xl font-extrabold">Session complete!</h2>
          <p className="mt-1 text-slate-400">Nicely read. Your reward has been added.</p>
          <p className="mt-4 font-display text-4xl font-extrabold text-emerald-500">+{formatNaira(earned)}</p>
          <div className="mt-6 flex w-full gap-3">
            <button onClick={() => nav("/earn")} className="btn-ghost flex-1 py-3.5">Back to Earn</button>
            <button onClick={() => nav("/wallet")} className="btn-primary flex-1 py-3.5">Withdraw</button>
          </div>
        </div>
      )}

      <Sheet open={langSheet} onClose={() => setLangSheet(false)} title="Choose a language">
        <p className="-mt-2 mb-3 text-sm text-slate-400">You only need to complete one</p>
        <div className="space-y-2">
          {VOICE_LANGS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLang(l)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition",
                lang.key === l.key ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-slate-100 dark:border-white/10",
              )}
            >
              <span className="text-2xl">{l.flag}</span>
              <span className="font-bold">{l.label}</span>
              <span className="text-sm text-slate-400">{l.sub}</span>
            </button>
          ))}
        </div>
        <button onClick={beginReading} className="btn-primary mt-4 w-full py-4 text-lg">
          <Play className="h-5 w-5" /> Begin
        </button>
      </Sheet>
    </Layout>
  );
}

