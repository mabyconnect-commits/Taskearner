import { useEffect, useState } from "react";
import { Check, Loader2, Instagram, PlaySquare, Star, ClipboardList, Send, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useStore } from "@/store/useStore";
import { ActivateGate } from "@/components/ActivateGate";
import { planById, DAILY_TASKS, DailyTask } from "@/lib/data";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type Result = { ok: boolean; msg: string; amount?: number };

const iconFor = (c: string) =>
  c === "social" ? Instagram : c === "watch" ? PlaySquare : c === "review" ? Star : c === "survey" ? ClipboardList : Send;

export default function Tasks() {
  const toast = useToast();
  const { plan, planActivated, completedTasks, earnActivity, mode, dailyUsed } = useStore();
  const p = planById(plan);
  const taskCap = p.daily.task;
  const taskUsed = Math.min(dailyUsed?.task ?? 0, taskCap);
  const capReached = taskUsed >= taskCap;
  const [verifying, setVerifying] = useState<DailyTask | null>(null);
  const [tab, setTab] = useState<"available" | "completed">("available");
  // Live tasks from the DB (admin-managed); fall back to bundled list offline.
  const [tasks, setTasks] = useState<DailyTask[]>(DAILY_TASKS);

  useEffect(() => {
    if (mode !== "online") return;
    let alive = true;
    api.tasks()
      .then((r) => { if (alive) setTasks(r.tasks as unknown as DailyTask[]); })
      .catch(() => { /* keep fallback */ });
    return () => { alive = false; };
  }, [mode]);

  if (!planActivated) return <ActivateGate title="Daily Tasks" />;

  // Tapping opens the task's link (if any) and launches the verification sheet:
  // a short countdown, then a quick math check, then the reward is claimed.
  const doTask = (t: DailyTask) => {
    if (completedTasks.includes(t.id) || verifying || capReached) return;
    const link = (t.link || "").trim();
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    setVerifying(t);
  };

  const verifyReward = async (t: DailyTask): Promise<Result> => {
    const res = await earnActivity("task", t.id);
    toast(res.ok ? `Task done! +${formatNaira(res.amount ?? p.perTask)}` : res.msg, res.ok ? "success" : "error");
    return res;
  };

  const done = completedTasks.filter((id) => tasks.some((t) => t.id === id)).length;
  const shown = tasks.filter((t) =>
    tab === "available" ? !completedTasks.includes(t.id) : completedTasks.includes(t.id),
  );

  return (
    <Layout hideNav>
      <PageHeader title="Daily Tasks" subtitle={`${formatNaira(p.perTask)} per task`} to="/earn" />

      <div className="card mb-5 flex items-center gap-4 p-5">
        <div className="relative grid h-16 w-16 place-items-center">
          <svg className="absolute h-16 w-16 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" className="fill-none stroke-slate-100 dark:stroke-white/10" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="44"
              className="fill-none stroke-brand-500" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - taskUsed / (taskCap || 1))}
            />
          </svg>
          <span className="font-display text-sm font-extrabold">{taskUsed}/{taskCap}</span>
        </div>
        <div>
          <p className="font-display text-lg font-bold">Today's progress</p>
          <p className="text-sm text-slate-400">
            {capReached ? "You've done today's task. Come back tomorrow!" : `You can do ${taskCap - taskUsed} task${taskCap - taskUsed > 1 ? "s" : ""} today.`}
          </p>
        </div>
      </div>

      {/* Available / Completed tabs */}
      <div className="mb-4 flex rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
        {(["available", "completed"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              "flex-1 rounded-xl py-3 text-sm font-bold capitalize transition",
              tab === tb ? "bg-brand-500 text-slate-900 shadow" : "text-slate-500",
            )}
          >
            {tb} {tb === "available" ? `(${tasks.length - done})` : `(${done})`}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="card flex flex-col items-center p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
            <Check className="h-7 w-7 text-brand-600 dark:text-brand-300" />
          </div>
          <p className="mt-3 text-slate-400">{tab === "available" ? "All tasks done for today. 🎉" : "No completed tasks yet."}</p>
        </div>
      )}

      <div className="space-y-3">
        {shown.map((t) => {
          const isDone = completedTasks.includes(t.id);
          const Icon = iconFor(t.category);
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-4 rounded-3xl p-4 transition",
                isDone ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-white shadow-soft dark:bg-white/[0.04]",
              )}
            >
              <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                isDone ? "bg-emerald-500 text-white" : "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300")}>
                {isDone ? <Check className="h-6 w-6" strokeWidth={3} /> : <Icon className="h-6 w-6" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("font-bold", isDone && "text-emerald-700 line-through dark:text-emerald-300")}>{t.title}</p>
                <p className="truncate text-sm text-slate-400">{t.detail}</p>
              </div>
              {isDone ? (
                <span className="text-sm font-bold text-emerald-600">+{formatNaira(p.perTask, false)}</span>
              ) : capReached ? (
                <span className="shrink-0 text-xs font-bold text-slate-400">Done for today</span>
              ) : (
                <button
                  onClick={() => doTask(t)}
                  className="btn-primary shrink-0 px-4 py-2.5 text-sm"
                >
                  {(t.link || "").trim() ? "Start task" : "Do it"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <TaskVerifySheet
        task={verifying}
        reward={p.perTask}
        onClose={() => setVerifying(null)}
        onVerify={verifyReward}
      />
    </Layout>
  );
}

// Slick task verification: a short countdown while the user does the task, then
// a quick anti-bot math check. Answering correctly claims the reward.
function TaskVerifySheet({
  task,
  reward,
  onClose,
  onVerify,
}: {
  task: DailyTask | null;
  reward: number;
  onClose: () => void;
  onVerify: (t: DailyTask) => Promise<Result>;
}) {
  const WAIT = 8; // seconds
  const [secs, setSecs] = useState(WAIT);
  const [phase, setPhase] = useState<"wait" | "quiz">("wait");
  const [q, setQ] = useState({ a: 0, b: 0 });
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Reset every time a task opens.
  useEffect(() => {
    if (!task) return;
    setSecs(WAIT);
    setPhase("wait");
    setVal("");
    setErr("");
    setQ({ a: Math.floor(Math.random() * 8) + 2, b: Math.floor(Math.random() * 8) + 2 });
  }, [task]);

  // Countdown tick.
  useEffect(() => {
    if (!task || phase !== "wait") return;
    if (secs <= 0) { setPhase("quiz"); return; }
    const id = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [task, phase, secs]);

  const submit = async () => {
    if (Number(val) !== q.a + q.b) {
      setErr("That's not correct — try again.");
      setVal("");
      return;
    }
    setBusy(true);
    const res = await onVerify(task!);
    setBusy(false);
    if (res.ok) onClose();
    else setErr(res.msg || "Could not verify. Try again.");
  };

  const pct = (WAIT - secs) / WAIT;
  const R = 44;

  return (
    <Sheet open={!!task} onClose={busy ? () => {} : onClose} title="Verify your task">
      {task && (
        <div className="text-center">
          {phase === "wait" ? (
            <>
              <div className="relative mx-auto grid h-28 w-28 place-items-center">
                <svg className="absolute h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={R} className="fill-none stroke-slate-100 dark:stroke-white/10" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r={R}
                    className="fill-none stroke-brand-500 transition-all duration-1000 ease-linear"
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * R}
                    strokeDashoffset={2 * Math.PI * R * (1 - pct)}
                  />
                </svg>
                <span className="font-display text-4xl font-extrabold">{secs}</span>
              </div>
              <p className="mt-4 font-display text-lg font-bold">Complete the task…</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Finish “{task.title}”{(task.link || "").trim() ? " in the tab that opened" : ""}. A quick check unlocks in a moment.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
                <ShieldCheck className="h-8 w-8 text-brand-600 dark:text-brand-300" />
              </div>
              <p className="mt-4 font-display text-lg font-bold">Quick check to claim {formatNaira(reward, false)}</p>
              <p className="mt-3 font-display text-3xl font-extrabold">{q.a} + {q.b} = ?</p>
              <input
                autoFocus
                value={val}
                onChange={(e) => { setVal(e.target.value.replace(/\D/g, "")); setErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                inputMode="numeric"
                placeholder="Your answer"
                className="input mx-auto mt-4 max-w-[200px] text-center text-2xl font-bold"
              />
              {err && <p className="mt-2 text-sm font-semibold text-rose-500">{err}</p>}
              <button onClick={submit} disabled={busy || !val} className="btn-primary mt-4 w-full py-4 text-lg disabled:opacity-60">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> Verify &amp; claim</>}
              </button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

