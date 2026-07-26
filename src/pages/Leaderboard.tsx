import { useEffect, useState } from "react";
import { Trophy, Crown } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/cn";

type Row = { name: string; handle: string; earned: number; refs: number; activeRefs?: number };

// Offline demo only — the live site shows real data from the database.
const DEMO: Row[] = [
  { name: "Blessing O.", handle: "blessedvoice", earned: 842000, refs: 118 },
  { name: "Samuel A.", handle: "samthevoice", earned: 611500, refs: 94 },
  { name: "Chidinma E.", handle: "chidi_earns", earned: 520000, refs: 77 },
  { name: "David M.", handle: "davidpays", earned: 388000, refs: 61 },
  { name: "Aisha B.", handle: "aisha_b", earned: 265000, refs: 44 },
];

const medal = ["from-amber-400 to-amber-600", "from-slate-300 to-slate-500", "from-orange-400 to-orange-700"];

export default function Leaderboard() {
  const { name, username, sales, referrals, mode } = useStore();
  const [top, setTop] = useState<Row[]>(mode === "online" ? [] : DEMO);
  const [loading, setLoading] = useState(mode === "online");

  useEffect(() => {
    if (mode !== "online") return;
    let alive = true;
    api.leaderboard()
      .then((r) => { if (alive) setTop(r.leaderboard); })
      .catch(() => { if (alive) setTop([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mode]);

  // Match by handle (usernames are unique; names can repeat or differ).
  const myRank = (() => {
    const idx = top.findIndex((u) => u.handle === username);
    return idx >= 0 ? idx + 1 : null;
  })();

  return (
    <Layout>
      <PageHeader title="Top Affiliates" subtitle="Biggest affiliate earners" to="/dashboard" />

      {/* podium — only when there are at least 3 real earners */}
      {top.length >= 3 && (
        <div className="mb-6 flex items-end justify-center gap-3">
          {[1, 0, 2].map((idx) => {
            const u = top[idx];
            const h = idx === 0 ? "h-28" : "h-20";
            return (
              <div key={u.handle} className="flex flex-1 flex-col items-center">
                <div className={cn("grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br text-lg font-extrabold text-white ring-4 ring-white dark:ring-[#0b0710]", medal[idx])}>
                  {u.name[0]?.toUpperCase()}
                </div>
                <p className="mt-1 truncate text-xs font-bold">{u.name.split(" ")[0]}</p>
                <p className="text-[11px] font-semibold text-emerald-500">{formatNaira(u.earned, false)}</p>
                <div className={cn("mt-1 w-full rounded-t-2xl bg-gradient-to-b from-brand-400 to-brand-600 text-center text-slate-900", h)}>
                  <span className="inline-block pt-2 font-display text-2xl font-extrabold">{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* your position (distinct from the champion — clearly labelled) */}
      <div className="mb-4 rounded-3xl bg-brand-500 p-4 text-slate-900 shadow-glow">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-900/60">Your position</p>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/10 font-display font-extrabold">
            {myRank ? `#${myRank}` : "—"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{name || "You"}</p>
            <p className="text-xs text-slate-800/70">
              {referrals.length} referral{referrals.length === 1 ? "" : "s"}
              {!myRank && " · refer & earn to rank"}
            </p>
          </div>
          <span className="font-display font-extrabold">{formatNaira(sales, false)}</span>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-slate-400">Loading leaderboard…</p>
      ) : top.length === 0 ? (
        <div className="card flex flex-col items-center p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
            <Trophy className="h-8 w-8 text-brand-500" />
          </div>
          <h3 className="mt-3 font-display text-lg font-bold">No affiliates on the board yet</h3>
          <p className="mt-1 text-sm text-slate-400">Be the first! Invite friends and your earnings will put you on top.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {top.slice(top.length >= 3 ? 3 : 0).map((u, i) => {
            const rank = (top.length >= 3 ? 3 : 0) + i + 1;
            const isMe = u.handle === username;
            return (
              <div
                key={u.handle}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-4 shadow-soft",
                  isMe ? "bg-brand-50 ring-2 ring-brand-400 dark:bg-brand-500/10" : "bg-white dark:bg-white/[0.04]",
                )}
              >
                <span className="w-6 text-center font-display font-extrabold text-slate-400">{rank}</span>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-ink-800 to-ink-950 font-bold text-white">{u.name[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{u.name}{isMe && <span className="ml-1.5 text-xs font-bold text-brand-600">You</span>}</p>
                  <p className="truncate text-xs text-slate-400">@{u.handle} · {u.refs} referral{u.refs === 1 ? "" : "s"}</p>
                </div>
                <span className="font-bold text-emerald-500">{formatNaira(u.earned, false)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 rounded-3xl bg-amber-50 p-5 dark:bg-amber-500/10">
        <Trophy className="h-8 w-8 shrink-0 text-amber-500" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Climb the ranks! The top 3 affiliates each month win bonus <Crown className="inline h-4 w-4" /> rewards.
        </p>
      </div>
    </Layout>
  );
}
