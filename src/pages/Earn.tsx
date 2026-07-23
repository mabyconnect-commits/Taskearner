import { useNavigate } from "react-router-dom";
import { Mic, BookOpen, CheckCircle2, Camera, ChevronRight } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { planById, DAILY_TASKS, SPONSORED_POSTS } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function Earn() {
  const nav = useNavigate();
  const { plan, cooldowns, completedTasks } = useStore();
  const p = planById(plan);
  const now = Date.now();

  const tasksLeft = DAILY_TASKS.filter((t) => !completedTasks.includes(t.id)).length;

  const activities = [
    {
      id: "voice",
      title: "Voice Earn",
      desc: "Read sentences aloud, word by word",
      reward: `+${formatNaira(p.perVoice)} per session`,
      icon: Mic,
      bg: "bg-brand-100 dark:bg-brand-500/20",
      fg: "text-brand-600 dark:text-brand-300",
      to: "/earn/voice",
      status: cooldowns["voice"] && cooldowns["voice"] > now ? "Cooldown" : "Available",
    },
    {
      id: "word",
      title: "Word Game",
      desc: "Pronounce long words within 10 seconds",
      reward: `+${formatNaira(p.perWord)} per word`,
      icon: BookOpen,
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
      fg: "text-emerald-500",
      to: "/earn/word-game",
      status: cooldowns["word"] && cooldowns["word"] > now ? "Cooldown" : "Available",
    },
    {
      id: "tasks",
      title: "Tasks",
      desc: "Complete daily tasks to earn",
      reward: `+${formatNaira(p.perTask)} per task`,
      icon: CheckCircle2,
      bg: "bg-amber-100 dark:bg-amber-500/20",
      fg: "text-amber-500",
      to: "/earn/tasks",
      status: `${tasksLeft} available`,
    },
    {
      id: "posts",
      title: "Sponsored Posts",
      desc: "Share posts on social media",
      reward: `+${formatNaira(p.perPost)} per post`,
      icon: Camera,
      bg: "bg-rose-100 dark:bg-rose-500/20",
      fg: "text-rose-500",
      to: "/earn/sponsored",
      status: `${SPONSORED_POSTS.length} available`,
    },
  ];

  return (
    <Layout>
      <PageHeader title="Ways to Earn" subtitle="Choose an activity" to="/dashboard" />

      {plan === "free" && (
        <button
          onClick={() => nav("/packages")}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-700 p-4 text-left text-white shadow-glow"
        >
          <div className="flex-1">
            <p className="font-bold">Activate a plan to start earning</p>
            <p className="text-sm text-white/75">Pay once, earn forever from every activity.</p>
          </div>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div className="space-y-3">
        {activities.map((a, i) => {
          const cooling = a.status === "Cooldown";
          return (
            <button
              key={a.id}
              onClick={() => nav(a.to)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="dotted flex w-full animate-fade-up items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-soft transition active:scale-[0.98] dark:bg-white/[0.04]"
            >
              <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-2xl", a.bg, a.fg)}>
                <a.icon className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold">{a.title}</p>
                <p className="text-sm text-slate-400">{a.desc}</p>
                <p className="mt-1 font-bold text-emerald-500">{a.reward}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold",
                    cooling
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                      : "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200",
                  )}
                >
                  {a.status}
                </span>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 rounded-2xl bg-slate-100 p-4 text-center text-sm text-slate-500 dark:bg-white/5">
        Earnings land in your <span className="font-bold text-brand-600 dark:text-brand-300">Engagement wallet</span> instantly.
        Cooldowns reset every 60 seconds in this demo.
      </p>
    </Layout>
  );
}
