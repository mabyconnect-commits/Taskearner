import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ArrowLeftRight, Banknote, ListChecks, Megaphone,
  Loader2, Plus, Check, X, Power, Trash2, RefreshCw, Wallet, Copy, Bot, ImagePlus,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { compressImage } from "@/lib/image";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

type Tab = "overview" | "users" | "deposits" | "payouts" | "transactions" | "tasks" | "sponsored";

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "deposits", label: "Deposits", icon: Wallet },
  { id: "payouts", label: "Payouts", icon: Banknote },
  { id: "transactions", label: "Activity", icon: ArrowLeftRight },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "sponsored", label: "Posts", icon: Megaphone },
];

export default function Admin() {
  const { isAdmin, mode, booting } = useStore();
  const [tab, setTab] = useState<Tab>("overview");

  if (booting) return null;
  // Admin lives on the server only; block offline demo + non-admins.
  if (mode !== "online" || !isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <Layout hideNav>
      <PageHeader title="Admin" subtitle="Manage Task Earner Africa" to="/dashboard" />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-bold transition",
                tab === t.id ? "bg-brand-500 text-slate-900" : "bg-slate-100 text-slate-500 dark:bg-white/5",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <Overview />}
      {tab === "users" && <UsersTab />}
      {tab === "deposits" && <DepositsTab />}
      {tab === "payouts" && <PayoutsTab />}
      {tab === "transactions" && <TransactionsTab />}
      {tab === "tasks" && <TasksTab />}
      {tab === "sponsored" && <SponsoredTab />}
    </Layout>
  );
}

function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = () => setNonce((n) => n + 1);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { data, loading, reload };
}

function Spinner() {
  return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>;
}

function Overview() {
  const { data, loading } = useAsync(() => api.adminOverview());
  const { data: bal, loading: balLoading } = useAsync(() => api.adminBalance());
  if (loading) return <Spinner />;
  const o = data?.overview;
  if (!o) return <p className="text-slate-400">Could not load overview.</p>;
  const cards = [
    { label: "Total users", value: o.users.toLocaleString(), tone: "brand" },
    { label: "Active (paid)", value: o.activeUsers.toLocaleString(), tone: "emerald" },
    { label: "Total deposits", value: formatNaira(o.totalDeposits), tone: "brand" },
    { label: "Total paid out", value: formatNaira(o.totalPaidOut), tone: "rose" },
    { label: "Pending payouts", value: o.pendingPayouts.toLocaleString(), tone: "amber" },
    { label: "Active tasks", value: o.activeTasks.toLocaleString(), tone: "emerald" },
    { label: "Posts awaiting review", value: o.pendingSponsored.toLocaleString(), tone: "amber" },
  ];
  return (
    <div className="space-y-3">
      {/* live gateway balance */}
      <div className="overflow-hidden rounded-4xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-6 text-white shadow-card">
        <p className="flex items-center gap-2 text-sm text-white/60"><Banknote className="h-4 w-4" /> NEKpay gateway balance</p>
        <p className="mt-1 font-display text-4xl font-extrabold">
          {balLoading ? "…" : bal?.ok ? formatNaira(bal.balance) : "Unavailable"}
        </p>
        {!balLoading && !bal?.ok && (
          <p className="mt-1 text-xs text-white/50">
            {(bal as any)?.error ? String((bal as any).error) : "Relay not configured or unreachable."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs font-semibold text-slate-400">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{c.value}</p>
          </div>
        ))}
      </div>

      <SupportBotCard />
    </div>
  );
}

// One-tap: register the Telegram support-bot webhook with Telegram and show its
// live status (so setup doesn't require the terminal).
function SupportBotCard() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string>("");
  const setup = async () => {
    setBusy(true);
    try {
      const r: any = await api.adminTelegramSetup();
      const wh = r?.info?.url || r?.webhookUrl || "";
      const pending = r?.info?.pending_update_count;
      const lastErr = r?.info?.last_error_message;
      setInfo([
        `webhook: ${wh || "—"}`,
        `support group: ${r?.supportGroup}`,
        pending != null ? `pending: ${pending}` : "",
        lastErr ? `last error: ${lastErr}` : "",
      ].filter(Boolean).join("\n"));
      toast(r?.ok ? "Support bot connected ✅" : "Set — check status below", r?.ok ? "success" : "info");
    } catch (e: any) {
      toast(e?.message || "Setup failed", "error");
      setInfo(e?.message || "Setup failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-bold"><Bot className="h-5 w-5 text-brand-600" /> Telegram support bot</p>
        <button onClick={setup} disabled={busy} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect webhook"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Set <span className="font-mono">TELEGRAM_BOT_TOKEN</span> &amp; <span className="font-mono">TELEGRAM_SUPPORT_GROUP_ID</span> in Vercel, then tap Connect. Add the bot to your ops group and send <span className="font-mono">/id</span> there to get the group id.
      </p>
      {info && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-2 text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-300">{info}</pre>}
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const { data, loading } = useAsync(() => api.adminUsers(term), [term]);
  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}
        className="mb-4 flex gap-2"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input flex-1" placeholder="Search name, email or username" />
        <button className="btn-primary px-4">Search</button>
      </form>
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {(data?.users ?? []).map((u: any) => (
            <div key={u.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold">{u.name}</p>
                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold uppercase text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">{u.plan}</span>
              </div>
              <p className="text-sm text-slate-400">{u.email} · @{u.username}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Engagement: <b>{formatNaira(u.engagement)}</b></span>
                <span>Sales: <b>{formatNaira(u.sales)}</b></span>
                <span>Deposit: <b>{formatNaira(u.deposit)}</b></span>
              </div>
            </div>
          ))}
          {(data?.users ?? []).length === 0 && <p className="py-6 text-center text-slate-400">No users found.</p>}
        </div>
      )}
    </div>
  );
}

function TransactionsTab() {
  const { data, loading } = useAsync(() => api.adminTransactions());
  if (loading) return <Spinner />;
  return (
    <div className="space-y-2">
      {(data?.transactions ?? []).map((t: any) => (
        <div key={t.id} className="card flex items-center justify-between p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{t.title}</p>
            <p className="truncate text-xs text-slate-400">{t.user} · {t.email} · {new Date(t.ts).toLocaleString()}</p>
          </div>
          <span className={cn("shrink-0 font-display font-bold", t.amount < 0 ? "text-rose-500" : "text-emerald-500")}>
            {t.amount < 0 ? "-" : "+"}{formatNaira(Math.abs(t.amount), false)}
          </span>
        </div>
      ))}
      {(data?.transactions ?? []).length === 0 && <p className="py-6 text-center text-slate-400">No activity yet.</p>}
    </div>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  if (!value) return null;
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(value).catch(() => {}); toast("Copied", "info"); }}
      className="mt-1 flex w-full items-center gap-1.5 text-left text-[11px] text-slate-400"
    >
      <span className="font-semibold">{label}:</span>
      <span className="truncate font-mono">{value}</span>
      <Copy className="h-3 w-3 shrink-0" />
    </button>
  );
}

function DepositsTab() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.adminDeposits());
  const [busy, setBusy] = useState<string | null>(null);
  const [probe, setProbe] = useState<Record<string, string>>({});

  const act = async (id: string, action: "credit" | "fail") => {
    setBusy(id);
    try {
      await api.adminDepositAction({ id, action });
      toast(action === "credit" ? "Wallet credited" : "Marked as failed", "success");
      reload();
    } catch (e: any) {
      toast(e?.message || "Failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const check = async (id: string) => {
    setBusy(id);
    try {
      const r: any = await api.adminDepositQuery({ id });
      setProbe((m) => ({ ...m, [id]: JSON.stringify({ detectedPaid: r.detectedPaid, credited: r.credited, amount: r.amount, raw: r.raw, error: r.error }, null, 1) }));
      if (r.credited) { toast("NEKpay confirmed — wallet credited ✅", "success"); reload(); }
      else toast(r.detectedPaid ? "Already credited" : "NEKpay says not paid yet", r.detectedPaid ? "success" : "info");
    } catch (e: any) {
      toast(e?.message || "Failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const tone = (s: string) =>
    s === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
    : s === "failed" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";

  if (loading) return <Spinner />;
  return (
    <div className="space-y-2">
      {(data?.deposits ?? []).map((d: any) => (
        <div key={d.id} className="card p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold">{formatNaira(d.amount)}</p>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold uppercase", tone(d.status))}>{d.status}</span>
          </div>
          <p className="text-sm text-slate-400">{d.user} · {d.email}</p>
          <p className="text-xs text-slate-500">{new Date(d.ts).toLocaleString()}</p>
          <IdRow label="NEKpay ID" value={d.nekpayId} />
          <IdRow label="Ref" value={d.reference} />
          {d.status !== "paid" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => act(d.id, "credit")} disabled={busy === d.id} className="btn-primary flex-1 py-2.5 text-sm">
                {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Force credit
              </button>
              <button onClick={() => check(d.id)} disabled={busy === d.id} className="btn-ghost flex-1 py-2.5 text-sm">
                <RefreshCw className="h-4 w-4" /> Check NEKpay
              </button>
              {d.status !== "failed" && (
                <button onClick={() => act(d.id, "fail")} disabled={busy === d.id} className="btn-ghost flex-1 py-2.5 text-sm text-rose-500">
                  <X className="h-4 w-4" /> Mark failed
                </button>
              )}
            </div>
          )}
          {probe[d.id] && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-900 p-3 text-[10px] leading-tight text-emerald-300">{probe[d.id]}</pre>
          )}
        </div>
      ))}
      {(data?.deposits ?? []).length === 0 && <p className="py-6 text-center text-slate-400">No deposits yet.</p>}
    </div>
  );
}

function PayoutsTab() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.adminPayouts());
  const [busy, setBusy] = useState<string | null>(null);
  const [probe, setProbe] = useState<Record<string, string>>({});

  const act = async (id: string, action: "approve" | "reject" | "retry" | "sync") => {
    setBusy(id);
    try {
      const r = await api.adminPayoutAction({ id, action });
      if (r.raw || r.note) setProbe((m) => ({ ...m, [id]: JSON.stringify({ status: r.status, note: r.note, raw: r.raw }, null, 1) }));
      const msg = action === "approve" ? "Marked as paid"
        : action === "reject" ? "Rejected & refunded"
        : action === "sync" ? (r.status === "paid" ? "Confirmed PAID" : r.status === "failed" ? "Gateway says failed — refunded" : `Gateway status: ${r.status}`)
        : "Retry dispatched";
      toast(msg, "success");
      reload();
    } catch (e: any) {
      toast(e?.message || "Failed", "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Spinner />;
  return (
    <div className="space-y-2">
      {(data?.payouts ?? []).map((p: any) => {
        const isSent = p.status === "SENT";
        const isPending = p.status === "PENDING";
        return (
          <div key={p.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold">{formatNaira(p.amount)}</p>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold",
                p.status === "PAID" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                : p.status === "REJECTED" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300")}>{p.status}</span>
            </div>
            <p className="text-sm text-slate-400">{p.user} · {p.wallet} wallet</p>
            <p className="text-xs text-slate-500">{p.bankName} · {p.accountNumber} · {p.accountName}</p>
            <IdRow label="NEKpay ID" value={p.nekpayId} />

            {/* SENT = already dispatched. Never re-send (double-pay). Sync = re-query. */}
            {isSent && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => act(p.id, "sync")} disabled={busy === p.id} className="btn-primary flex-1 py-2.5 text-sm">
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync status
                </button>
                <button onClick={() => act(p.id, "approve")} disabled={busy === p.id} className="btn-ghost flex-1 py-2.5 text-sm">
                  <Check className="h-4 w-4" /> Mark paid
                </button>
              </div>
            )}
            {isPending && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => act(p.id, "retry")} disabled={busy === p.id} className="btn-primary flex-1 py-2.5 text-sm">
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Send
                </button>
                <button onClick={() => act(p.id, "approve")} disabled={busy === p.id} className="btn-ghost flex-1 py-2.5 text-sm">
                  <Check className="h-4 w-4" /> Mark paid
                </button>
                <button onClick={() => act(p.id, "reject")} disabled={busy === p.id} className="btn-ghost flex-1 py-2.5 text-sm text-rose-500">
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            )}
            {probe[p.id] && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-900 p-3 text-[10px] leading-tight text-emerald-300">{probe[p.id]}</pre>
            )}
          </div>
        );
      })}
      {(data?.payouts ?? []).length === 0 && <p className="py-6 text-center text-slate-400">No payouts yet.</p>}
    </div>
  );
}

function TasksTab() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.adminTasks());
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", detail: "", category: "social", link: "" });
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (form.title.trim().length < 3) return toast("Task title is required", "error");
    setCreating(true);
    try {
      await api.adminCreateTask(form);
      toast("Task added", "success");
      setForm({ title: "", detail: "", category: "social", link: "" });
      reload();
    } catch (e: any) {
      toast(e?.message || "Failed", "error");
    } finally {
      setCreating(false);
    }
  };

  const act = async (id: string, action: "enable" | "disable" | "delete") => {
    setBusy(id);
    try {
      await api.adminTaskAction({ id, action });
      reload();
    } catch (e: any) {
      toast(e?.message || "Failed", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="card mb-4 space-y-3 p-4">
        <p className="font-display font-bold">Upload a new daily task</p>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="Task title" />
        <input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} className="input" placeholder="Short instruction" />
        <div className="flex gap-2">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input flex-1">
            {["social", "watch", "review", "survey", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="input flex-1" placeholder="Link (optional)" />
        </div>
        <button onClick={create} disabled={creating} className="btn-primary w-full py-3">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add task
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {(data?.tasks ?? []).map((t: any) => (
            <div key={t.id} className={cn("card p-4", !t.active && "opacity-60")}>
              <div className="flex items-center justify-between">
                <p className="font-bold">{t.title}</p>
                <span className="text-xs font-semibold uppercase text-slate-400">{t.category}</span>
              </div>
              <p className="text-sm text-slate-400">{t.detail}</p>
              {t.link
                ? <a href={t.link} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs font-medium text-brand-600">🔗 {t.link}</a>
                : <p className="mt-1 text-xs text-amber-500">No link — tapping just credits. Delete &amp; re-add with a link to send users somewhere.</p>}
              <div className="mt-2 flex gap-2">
                <button onClick={() => act(t.id, t.active ? "disable" : "enable")} disabled={busy === t.id} className="btn-ghost flex-1 py-2 text-sm">
                  <Power className="h-4 w-4" /> {t.active ? "Disable" : "Enable"}
                </button>
                <button onClick={() => act(t.id, "delete")} disabled={busy === t.id} className="btn-ghost flex-1 py-2 text-sm text-rose-500">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SponsoredTab() {
  const toast = useToast();
  const { data, loading, reload } = useAsync(() => api.adminSponsored());
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ headline: "", copy: "", platform: "Facebook", budget: "" });
  const [image, setImage] = useState<string>("");
  const [imgBusy, setImgBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const pickImage = async (file?: File) => {
    if (!file) return;
    setImgBusy(true);
    try {
      setImage(await compressImage(file));
    } catch (e: any) {
      toast(e?.message || "Could not process that image", "error");
    } finally {
      setImgBusy(false);
    }
  };

  const create = async () => {
    if (form.headline.trim().length < 3) return toast("Headline is required", "error");
    if (form.copy.trim().length < 10) return toast("Post content is required", "error");
    setCreating(true);
    try {
      await api.adminCreateSponsored({ headline: form.headline.trim(), copy: form.copy.trim(), platform: form.platform, budget: Number(form.budget) || 0, image: image || undefined });
      toast("Official post published", "success");
      setForm({ headline: "", copy: "", platform: "Facebook", budget: "" });
      setImage("");
      reload();
    } catch (e: any) {
      toast(e?.message || "Failed", "error");
    } finally {
      setCreating(false);
    }
  };

  const act = async (id: string, action: "approve" | "reject" | "end" | "complete") => {
    setBusy(id);
    try {
      await api.adminSponsoredAction({ id, action });
      toast(action === "approve" ? "Approved & live" : action === "reject" ? "Rejected & refunded" : action === "complete" ? "Verified & completed" : "Ended", "success");
      reload();
    } catch (e: any) {
      toast(e?.message || "Failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const statusTone = (s: string) =>
    s === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
    : s === "completed" ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
    : s === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
    : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300";

  const stats = data?.stats;

  return (
    <div>
      {/* advert tracking */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400">Advertisers</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{stats.advertisers.toLocaleString()}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400">Advert revenue</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-emerald-600">{formatNaira(stats.revenue)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400">Awaiting review</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-amber-500">{stats.pending}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400">People reached</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{stats.reached.toLocaleString()}<span className="text-sm text-slate-400">/{stats.target.toLocaleString()}</span></p>
          </div>
        </div>
      )}

      <div className="card mb-4 space-y-3 p-4">
        <p className="font-display font-bold">Publish an official post</p>
        <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className="input" placeholder="Headline" />
        <textarea value={form.copy} onChange={(e) => setForm({ ...form, copy: e.target.value })} className="input min-h-[70px] resize-none" placeholder="Caption earners will share" />
        <div className="flex gap-2">
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="input flex-1">
            {["WhatsApp", "Facebook", "X", "Instagram", "TikTok"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value.replace(/\D/g, "") })} className="input flex-1" placeholder="Budget (0 = unlimited)" inputMode="numeric" />
        </div>
        {image ? (
          <div className="relative overflow-hidden rounded-2xl">
            <img src={image} alt="Post image preview" className="max-h-52 w-full bg-slate-100 object-contain dark:bg-black/30" />
            <button onClick={() => setImage("")} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-5 text-sm font-semibold text-slate-500 dark:border-white/10">
            {imgBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {imgBusy ? "Processing…" : "Add image (earners can download it)"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
          </label>
        )}
        <button onClick={create} disabled={creating || imgBusy} className="btn-primary w-full py-3">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Publish
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {(data?.sponsored ?? []).map((s: any) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {s.kind === "special" && <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">Special</span>}
                  <p className="truncate font-bold">{s.headline}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", statusTone(s.status))}>{s.status}</span>
              </div>
              {s.image && <img src={s.image} alt={s.headline} className="mt-2 max-h-40 w-full rounded-xl bg-slate-100 object-contain dark:bg-black/30" />}
              <p className="mt-2 text-sm text-slate-400">"{s.copy}"</p>
              <p className="mt-1 text-xs text-slate-500">
                {s.kind === "special" ? "Custom task" : s.platform} · by {s.advertiser}
                {s.target > 0 && <> · reach {s.reached}/{s.target} people</>}
                {s.budget > 0 && <> · paid {formatNaira(s.budget)}</>}
              </p>
              <div className="mt-3 flex gap-2">
                {s.status === "pending" && (
                  <>
                    <button onClick={() => act(s.id, "approve")} disabled={busy === s.id} className="btn-primary flex-1 py-2 text-sm">
                      {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                    </button>
                    <button onClick={() => act(s.id, "reject")} disabled={busy === s.id} className="btn-ghost flex-1 py-2 text-sm text-rose-500">
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </>
                )}
                {s.status === "active" && (
                  <>
                    <button onClick={() => act(s.id, "complete")} disabled={busy === s.id} className="btn-primary flex-1 py-2 text-sm">
                      {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Verify done
                    </button>
                    <button onClick={() => act(s.id, "end")} disabled={busy === s.id} className="btn-ghost flex-1 py-2 text-sm">
                      <RefreshCw className="h-4 w-4" /> End &amp; refund
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
