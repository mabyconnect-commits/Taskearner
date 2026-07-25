import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Copy, Check, Share2, Crown, Loader2, Megaphone, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { planById, SPONSORED_POSTS, SponsoredPost, SALES_WITHDRAW_MIN } from "@/lib/data";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const PLATFORMS = ["WhatsApp", "Facebook", "X", "Instagram", "TikTok"] as const;

export default function Sponsored() {
  const nav = useNavigate();
  const toast = useToast();
  const { plan, socialLinked, earnActivity, completedPosts, mode, deposit, advertisePost, dailyUsed } = useStore();
  const p = planById(plan);
  const postCap = p.daily.post;
  const postCapReached = (dailyUsed?.post ?? 0) >= postCap;
  const [posts, setPosts] = useState<SponsoredPost[]>(SPONSORED_POSTS);
  const [shared, setShared] = useState<string[]>(completedPosts);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    if (mode !== "online") return;
    let alive = true;
    api.sponsored()
      .then((r) => { if (alive && r.sponsored.length) setPosts(r.sponsored as unknown as SponsoredPost[]); })
      .catch(() => { /* keep fallback */ });
    return () => { alive = false; };
  }, [mode]);

  if (plan === "free") return <Locked nav={nav} />;

  const copy = (post: SponsoredPost) => {
    navigator.clipboard?.writeText(post.copy).catch(() => {});
    setCopied(post.id);
    setTimeout(() => setCopied(null), 1500);
    toast("Caption copied — now share it!", "info");
  };

  const share = (post: SponsoredPost) => {
    if (shared.includes(post.id) || busy || postCapReached) return;
    setBusy(post.id);
    setTimeout(async () => {
      const res = await earnActivity("post", post.id);
      setBusy(null);
      if (res.ok) {
        setShared((s) => [...s, post.id]);
        toast(`Post verified! +${formatNaira(res.amount ?? p.perPost)}`);
      } else {
        toast(res.msg, "error");
      }
    }, 1400);
  };

  return (
    <Layout hideNav>
      <PageHeader title="Sponsored Posts" subtitle={`${formatNaira(p.perPost)} per post`} to="/earn" />

      <button
        onClick={() => setAdvertising(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-ink-800 to-ink-950 p-4 text-left text-white shadow-card"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-500/20 text-brand-400">
          <Megaphone className="h-6 w-6" />
        </span>
        <span className="flex-1">
          <span className="block font-display font-bold">Advertise with us</span>
          <span className="block text-xs text-white/60">Pay to have your own post shared by earners.</span>
        </span>
        <span className="text-brand-400">→</span>
      </button>

      {!socialLinked && (
        <button
          onClick={() => nav("/profile")}
          className="mb-4 w-full rounded-2xl bg-amber-50 p-4 text-left text-sm font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
        >
          Tip: link your social accounts in Profile so posts verify instantly.
        </button>
      )}

      <div className="space-y-4">
        {posts.map((post) => {
          const isShared = shared.includes(post.id);
          return (
            <div key={post.id} className="card overflow-hidden">
              {/* promo banner (the shareable graphic) */}
              <div className="relative overflow-hidden bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-5 text-white">
                <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-500/25 blur-2xl" />
                <p className="font-display text-3xl font-extrabold leading-none text-brand-400">MILLIONS<br />DAILY!</p>
                <p className="mt-2 max-w-[80%] text-xs text-white/70">{post.headline} — join Task Earner Africa and turn your voice into alerts. 💸</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">
                  ✓ Credit Alert · NGN 250,000.00
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400">Share on: <b className="text-slate-600 dark:text-slate-200">{post.platform.toUpperCase()}</b></p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">+{formatNaira(p.perPost, false)}</span>
                </div>
                <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">"{post.copy}"</p>
                <button onClick={() => copy(post)} className="btn-ghost mt-3 w-full py-3 text-sm">
                  {copied === post.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === post.id ? "Copied" : "Copy content"}
                </button>
                <button
                  onClick={() => share(post)}
                  disabled={isShared || !!busy || (postCapReached && !isShared)}
                  className={cn("btn mt-2 w-full py-3.5 text-white", isShared ? "bg-emerald-500" : "btn-primary")}
                >
                  {busy === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isShared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  {isShared ? "Posted & credited" : postCapReached ? "Done for today" : "I have performed this post"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {advertising &&
        createPortal(
          <AdvertiseSheet
            deposit={deposit}
            onClose={() => setAdvertising(false)}
            onSubmit={advertisePost}
          />,
          document.body,
        )}
    </Layout>
  );
}

function AdvertiseSheet({
  deposit,
  onClose,
  onSubmit,
}: {
  deposit: number;
  onClose: () => void;
  onSubmit: (p: { headline: string; copy: string; platform: string; budget: number }) => Promise<{ ok: boolean; msg: string }>;
}) {
  const toast = useToast();
  const [headline, setHeadline] = useState("");
  const [copy, setCopy] = useState("");
  const [platform, setPlatform] = useState<string>("WhatsApp");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(budget) || 0;

  const submit = async () => {
    if (headline.trim().length < 3) return toast("Give your campaign a headline", "error");
    if (copy.trim().length < 10) return toast("Write the post content earners will share", "error");
    if (n < SALES_WITHDRAW_MIN) return toast(`Minimum budget is ${formatNaira(SALES_WITHDRAW_MIN)}`, "error");
    if (n > deposit) return toast("Insufficient deposit. Fund your wallet first.", "error");
    setBusy(true);
    const res = await onSubmit({ headline: headline.trim(), copy: copy.trim(), platform, budget: n });
    setBusy(false);
    toast(res.msg, res.ok ? "success" : "error");
    if (res.ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-4xl bg-white p-6 dark:bg-ink-900 sm:rounded-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">Advertise with us</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 dark:bg-white/5"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Your post is shared by real earners across Nigeria. Set a budget — earners are paid from it per share, and your campaign ends when it's used up. Goes live after a quick review.
        </p>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">Headline</span>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="input" placeholder="e.g. Grand opening this weekend" maxLength={60} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">Post content</span>
            <textarea value={copy} onChange={(e) => setCopy(e.target.value)} className="input min-h-[90px] resize-none" placeholder="The exact caption earners will post…" maxLength={280} />
          </label>
          <div>
            <span className="mb-2 block text-sm font-semibold text-slate-500">Platform</span>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((pv) => (
                <button key={pv} onClick={() => setPlatform(pv)} className={cn("rounded-xl px-4 py-2.5 text-sm font-bold transition", platform === pv ? "bg-brand-500 text-slate-900" : "bg-slate-100 text-slate-500 dark:bg-white/5")}>
                  {pv}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">Budget (from your deposit · {formatNaira(deposit)} available)</span>
            <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} className="input text-xl font-bold" placeholder="0" inputMode="numeric" />
          </label>
          <div className="flex flex-wrap gap-2">
            {[1000, 5000, 10000, 25000].map((v) => (
              <button key={v} onClick={() => setBudget(String(v))} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-brand-600 dark:bg-white/5 dark:text-brand-300">
                {formatNaira(v, false)}
              </button>
            ))}
          </div>
          <button onClick={submit} disabled={busy} className="btn-primary w-full py-4 text-lg">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${n ? formatNaira(n) : ""} & submit`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Locked({ nav }: { nav: ReturnType<typeof useNavigate> }) {
  return (
    <Layout hideNav>
      <PageHeader title="Sponsored Posts" to="/earn" />
      <div className="card mt-10 flex flex-col items-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
          <Crown className="h-10 w-10 text-brand-500" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold">Activate a plan first</h2>
        <p className="mt-1 text-slate-400">Sponsored posts unlock with any lifetime plan.</p>
        <button onClick={() => nav("/packages")} className="btn-primary mt-6 w-full py-4">View plans</button>
      </div>
    </Layout>
  );
}
