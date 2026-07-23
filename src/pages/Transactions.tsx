import { Mic, Gamepad2, Megaphone, CheckCircle2, Crown, Wallet, ArrowUp, Users, Zap, Receipt } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { TxType } from "@/store/useStore";
import { formatNaira, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

const meta: Record<TxType, { icon: typeof Mic; bg: string; fg: string }> = {
  voice: { icon: Mic, bg: "bg-brand-100 dark:bg-brand-500/20", fg: "text-brand-600 dark:text-brand-300" },
  word: { icon: Gamepad2, bg: "bg-brand-100 dark:bg-brand-500/20", fg: "text-brand-600 dark:text-brand-300" },
  post: { icon: Megaphone, bg: "bg-amber-100 dark:bg-amber-500/20", fg: "text-amber-600 dark:text-amber-300" },
  task: { icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-500/20", fg: "text-emerald-600 dark:text-emerald-300" },
  plan: { icon: Crown, bg: "bg-amber-100 dark:bg-amber-500/20", fg: "text-amber-600 dark:text-amber-300" },
  fund: { icon: Wallet, bg: "bg-emerald-100 dark:bg-emerald-500/20", fg: "text-emerald-600 dark:text-emerald-300" },
  withdraw: { icon: ArrowUp, bg: "bg-rose-100 dark:bg-rose-500/20", fg: "text-rose-600 dark:text-rose-300" },
  commission: { icon: Users, bg: "bg-indigo-100 dark:bg-indigo-500/20", fg: "text-indigo-600 dark:text-indigo-300" },
  bill: { icon: Zap, bg: "bg-sky-100 dark:bg-sky-500/20", fg: "text-sky-600 dark:text-sky-300" },
};

export default function Transactions() {
  const { transactions } = useStore();

  return (
    <Layout>
      <PageHeader title="Transactions" subtitle="Your activity history" to="/dashboard" />

      {transactions.length === 0 ? (
        <div className="card mt-10 flex flex-col items-center p-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
            <Receipt className="h-8 w-8 text-brand-500" />
          </div>
          <p className="mt-3 font-bold">No transactions yet</p>
          <p className="text-sm text-slate-400">Start earning and your history will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((t) => {
            const m = meta[t.type];
            const Icon = m.icon;
            return (
              <div key={t.id} className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-soft dark:bg-white/[0.04]">
                <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", m.bg, m.fg)}>
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{t.title}</p>
                  <p className="text-sm text-slate-400">{timeAgo(t.ts)}</p>
                </div>
                <span className={cn("shrink-0 font-display font-extrabold", t.amount >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {t.amount >= 0 ? "+" : ""}{formatNaira(t.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
