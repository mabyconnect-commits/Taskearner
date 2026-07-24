import { Bell, Gift, TrendingUp, Megaphone, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";

const NOTES = [
  { icon: Gift, color: "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300", title: "Welcome bonus unlocked", body: "Activate any plan today and earn a ₦500 welcome bonus.", time: "2m ago", unread: true },
  { icon: TrendingUp, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300", title: "Voice rates increased", body: "Prime Artiste now earns ₦600 per Voice Earn session.", time: "1h ago", unread: true },
  { icon: Megaphone, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300", title: "New sponsored posts", body: "5 fresh posts are available. Share and earn now.", time: "3h ago", unread: false },
  { icon: ShieldCheck, color: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300", title: "Security tip", body: "Never place withdrawals using Moniepoint or Paga as your bank.", time: "1d ago", unread: false },
];

export default function Notifications() {
  return (
    <Layout>
      <PageHeader title="Notifications" subtitle="Stay in the loop" to="/dashboard" />
      <div className="space-y-3">
        {NOTES.map((n, i) => (
          <div key={i} className={cn("flex gap-4 rounded-3xl p-4 shadow-soft", n.unread ? "bg-brand-50 dark:bg-brand-500/10" : "bg-white dark:bg-white/[0.04]")}>
            <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", n.color)}>
              <n.icon className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold">{n.title}</p>
                {n.unread && <span className="h-2 w-2 rounded-full bg-brand-500" />}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-300">{n.body}</p>
              <p className="mt-1 text-xs text-slate-400">{n.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center text-center text-slate-400">
        <Bell className="h-6 w-6" />
        <p className="mt-1 text-sm">That's everything for now.</p>
      </div>
    </Layout>
  );
}
