import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Instagram, PlaySquare, Star, ClipboardList, Send, Crown } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { planById, DAILY_TASKS, DailyTask } from "@/lib/data";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const iconFor = (c: string) =>
  c === "social" ? Instagram : c === "watch" ? PlaySquare : c === "review" ? Star : c === "survey" ? ClipboardList : Send;

export default function Tasks() {
  const nav = useNavigate();
  const toast = useToast();
  const { plan, completedTasks, earnActivity, mode } = useStore();
  const p = planById(plan);
  const [busy, setBusy] = useState<string | null>(null);
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

  if (plan === "free") return <Locked nav={nav} />;

  const doTask = (t: DailyTask) => {
    if (completedTasks.includes(t.id) || busy) return;
    setBusy(t.id);
    setTimeout(async () => {
      const res = await earnActivity("task", t.id);
      setBusy(null);
      toast(res.ok ? `Task done! +${formatNaira(res.amount ?? p.perTask)}` : res.msg, res.ok ? "success" : "error");
    }, 1200);
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
              strokeDashoffset={2 * Math.PI * 44 * (1 - done / (tasks.length || 1))}
            />
          </svg>
          <span className="font-display text-sm font-extrabold">{done}/{tasks.length}</span>
        </div>
        <div>
          <p className="font-display text-lg font-bold">Today's progress</p>
          <p className="text-sm text-slate-400">Complete all tasks to max out your daily earnings.</p>
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
              ) : (
                <button
                  onClick={() => doTask(t)}
                  disabled={!!busy}
                  className="btn-primary shrink-0 px-4 py-2.5 text-sm"
                >
                  {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Do it"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}

function Locked({ nav }: { nav: ReturnType<typeof useNavigate> }) {
  return (
    <Layout hideNav>
      <PageHeader title="Daily Tasks" to="/earn" />
      <div className="card mt-10 flex flex-col items-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
          <Crown className="h-10 w-10 text-brand-500" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold">Activate a plan first</h2>
        <p className="mt-1 text-slate-400">Daily tasks unlock with any lifetime plan.</p>
        <button onClick={() => nav("/packages")} className="btn-primary mt-6 w-full py-4">View plans</button>
      </div>
    </Layout>
  );
}
