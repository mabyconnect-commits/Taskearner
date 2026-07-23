import { Trophy, Crown } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/cn";

const TOP = [
  { name: "Blessing O.", handle: "blessedvoice", earned: 842000, refs: 118 },
  { name: "Samuel A.", handle: "samthevoice", earned: 611500, refs: 94 },
  { name: "Chidinma E.", handle: "chidi_earns", earned: 520000, refs: 77 },
  { name: "David M.", handle: "davidpays", earned: 388000, refs: 61 },
  { name: "Aisha B.", handle: "aisha_b", earned: 265000, refs: 44 },
  { name: "Tunde F.", handle: "tundef", earned: 190000, refs: 33 },
  { name: "Ngozi U.", handle: "ngoziu", earned: 142000, refs: 25 },
];

const medal = ["from-amber-400 to-amber-600", "from-slate-300 to-slate-500", "from-orange-400 to-orange-700"];

export default function Leaderboard() {
  const { name, sales, referrals } = useStore();

  return (
    <Layout>
      <PageHeader title="Top Affiliates" subtitle="This month's biggest earners" to="/dashboard" />

      {/* podium */}
      <div className="mb-6 flex items-end justify-center gap-3">
        {[1, 0, 2].map((idx) => {
          const u = TOP[idx];
          const h = idx === 0 ? "h-28" : "h-20";
          return (
            <div key={u.handle} className="flex flex-1 flex-col items-center">
              <div className={cn("grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br text-lg font-extrabold text-white ring-4 ring-white dark:ring-[#0b0710]", medal[idx])}>
                {u.name[0]}
              </div>
              <p className="mt-1 truncate text-xs font-bold">{u.name.split(" ")[0]}</p>
              <p className="text-[11px] font-semibold text-emerald-500">{formatNaira(u.earned, false)}</p>
              <div className={cn("mt-1 w-full rounded-t-2xl bg-gradient-to-b from-brand-400 to-brand-600 text-center text-white", h)}>
                <span className="inline-block pt-2 font-display text-2xl font-extrabold">{idx + 1}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* your rank */}
      <div className="mb-4 flex items-center gap-3 rounded-3xl bg-gradient-to-r from-brand-500 to-brand-700 p-4 text-white shadow-glow">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/20 font-extrabold">—</span>
        <div className="flex-1">
          <p className="font-bold">{name || "You"}</p>
          <p className="text-xs text-white/70">{referrals.length} referrals</p>
        </div>
        <span className="font-display font-extrabold">{formatNaira(sales, false)}</span>
      </div>

      <div className="space-y-2">
        {TOP.slice(3).map((u, i) => (
          <div key={u.handle} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft dark:bg-white/[0.04]">
            <span className="w-6 text-center font-display font-extrabold text-slate-400">{i + 4}</span>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-white">{u.name[0]}</div>
            <div className="flex-1">
              <p className="font-bold">{u.name}</p>
              <p className="text-xs text-slate-400">@{u.handle} · {u.refs} refs</p>
            </div>
            <span className="font-bold text-emerald-500">{formatNaira(u.earned, false)}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-3xl bg-amber-50 p-5 dark:bg-amber-500/10">
        <Trophy className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Climb the ranks! The top 3 affiliates each month win bonus <Crown className="inline h-4 w-4" /> rewards.
        </p>
      </div>
    </Layout>
  );
}
