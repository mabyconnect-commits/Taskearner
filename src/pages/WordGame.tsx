import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, Check, Play, Square, Loader2, X, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useStore } from "@/store/useStore";
import { planById, WORD_LANGS, WordLang } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { useSpeech, wordMatches } from "@/lib/speech";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const ROUNDS = 2;
type Phase = "intro" | "playing" | "done";

export default function WordGame() {
  const nav = useNavigate();
  const toast = useToast();
  const { plan, earnActivity } = useStore();
  const p = planById(plan);

  const [phase, setPhase] = useState<Phase>("intro");
  const [langSheet, setLangSheet] = useState(false);
  const [lang, setLang] = useState<WordLang>(WORD_LANGS[0]);
  const [autoStart, setAutoStart] = useState(true);
  const [round, setRound] = useState(0);
  const [earned, setEarned] = useState(0);
  const [busy, setBusy] = useState(false);
  const correct = useRef(0);

  const words = useMemo(() => [...lang.words].sort(() => Math.random() - 0.5).slice(0, ROUNDS), [lang, phase === "playing"]);
  const current = words[round];
  const { supported, listening, transcript, start, stop, reset } = useSpeech(lang.code);


  const beginGame = () => {
    setLangSheet(false);
    setPhase("playing");
    setRound(0);
    correct.current = 0;
    if (autoStart && supported) setTimeout(start, 350);
  };

  const speak = () => {
    try {
      const u = new SpeechSynthesisUtterance(current.word);
      u.lang = lang.code;
      u.rate = 0.85;
      window.speechSynthesis?.speak(u);
    } catch { /* ignore */ }
  };

  const check = async () => {
    stop();
    const ok = supported ? wordMatches(transcript, current.word) : true;
    if (ok) {
      correct.current += 1;
      toast(`Correct! “${current.word}” 👏`);
    } else {
      toast(`Hmm, that didn't match “${current.word}”. Try the next one.`, "error");
    }
    reset();
    if (round + 1 < ROUNDS) {
      setRound(round + 1);
      if (autoStart && supported) setTimeout(start, 500);
    } else {
      setPhase("done");
      if (correct.current > 0) {
        setBusy(true);
        const res = await earnActivity("word", undefined, correct.current);
        setBusy(false);
        setEarned(res.ok ? res.amount ?? p.perWord * correct.current : 0);
        if (!res.ok) toast(res.msg, "error");
      } else {
        setEarned(0);
      }
    }
  };

  return (
    <Layout hideNav>
      <PageHeader
        title="Word Game"
        subtitle={`Say ${ROUNDS} words to earn ${formatNaira(p.perWord * ROUNDS)}`}
        to="/earn"
        right={
          <button onClick={() => toast("Tap the mic, say the word clearly, then tap Done.", "info")} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
            <HelpCircle className="h-5 w-5" />
          </button>
        }
      />

      {phase === "intro" && (
        <>
          <div className="card dotted flex flex-col items-center p-8 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
              <Volume2 className="h-10 w-10 text-brand-600 dark:text-brand-300" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-extrabold">Word Game</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-300">
              Say <b>{ROUNDS} words</b> correctly to earn <span className="font-bold text-emerald-500">{formatNaira(p.perWord * ROUNDS)}</span>. No timer — just say each word clearly.
            </p>
          </div>

          <button onClick={() => setLangSheet(true)} className="btn-primary mt-5 w-full py-4 text-lg">
            <Play className="h-5 w-5" /> Start Game
          </button>

          <div className="mt-4 flex items-center gap-4 rounded-3xl bg-white p-4 shadow-soft dark:bg-white/[0.04]">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500 text-slate-900"><Volume2 className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="font-bold">Auto-start microphone</p>
              <p className="text-sm text-slate-400">Start listening automatically each round</p>
            </div>
            <button onClick={() => setAutoStart((v) => !v)} className={cn("relative h-7 w-12 rounded-full transition", autoStart ? "bg-brand-500" : "bg-slate-300 dark:bg-white/20")}>
              <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all", autoStart ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
        </>
      )}

      {phase === "playing" && current && (
        <div className="card p-6 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Word {round + 1} of {ROUNDS} — say it aloud</p>
          <p className="mt-3 font-display text-4xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">{current.word}</p>
          <p className="mt-1 text-slate-400">({current.hint})</p>

          <button onClick={speak} className="btn-ghost mx-auto mt-3 px-4 py-2 text-sm"><Volume2 className="h-4 w-4" /> Hear it</button>

          <div className="mt-5 flex flex-col items-center">
            <button
              onClick={listening ? stop : start}
              disabled={!supported}
              className={cn(
                "relative grid h-24 w-24 place-items-center rounded-full text-white shadow-glow transition active:scale-95",
                listening ? "bg-rose-500" : "bg-brand-500 text-slate-900",
              )}
            >
              {listening && <span className="absolute inset-0 animate-pulseRing rounded-full ring-4 ring-rose-400/50" />}
              {listening ? <Square className="h-9 w-9" /> : <Volume2 className="h-9 w-9" />}
            </button>
            <p className={cn("mt-3 text-sm font-semibold", listening ? "text-rose-500" : "text-slate-500")}>
              {!supported ? "Speech not available — tap Done to continue" : listening ? "● Listening… say it, then tap stop" : "Tap to start speaking"}
            </p>
            {transcript && <p className="mt-1 text-xs text-slate-400">heard: “{transcript}”</p>}
          </div>

          <button onClick={check} disabled={busy} className="btn-primary mt-5 w-full py-4 text-lg">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> Done — check my voice</>}
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="card flex flex-col items-center p-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn("grid h-20 w-20 place-items-center rounded-full", earned > 0 ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-rose-100 dark:bg-rose-500/20")}>
            {earned > 0 ? <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} /> : <X className="h-10 w-10 text-rose-500" strokeWidth={3} />}
          </motion.div>
          <h2 className="mt-4 font-display text-2xl font-extrabold">Game over!</h2>
          <p className="mt-1 text-slate-400">{correct.current} of {ROUNDS} words correct.</p>
          <p className="mt-4 font-display text-4xl font-extrabold text-emerald-500">+{formatNaira(earned)}</p>
          <div className="mt-6 flex w-full gap-3">
            <button onClick={() => nav("/earn")} className="btn-ghost flex-1 py-3.5">Done</button>
            <button onClick={() => nav("/wallet")} className="btn-primary flex-1 py-3.5">Withdraw</button>
          </div>
        </div>
      )}

      <Sheet open={langSheet} onClose={() => setLangSheet(false)} title="Choose a language">
        <div className="space-y-2">
          {WORD_LANGS.map((l) => (
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
        <button onClick={beginGame} className="btn-primary mt-4 w-full py-4 text-lg">
          <Play className="h-5 w-5" /> Begin
        </button>
      </Sheet>
    </Layout>
  );
}

