import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check, Share2, Crown, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { planById, SPONSORED_POSTS, SponsoredPost } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export default function Sponsored() {
  const nav = useNavigate();
  const toast = useToast();
  const { plan, socialLinked, earnActivity, completedPosts } = useStore();
  const p = planById(plan);
  const [shared, setShared] = useState<string[]>(completedPosts);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (plan === "free") return <Locked nav={nav} />;

  const copy = (post: SponsoredPost) => {
    navigator.clipboard?.writeText(post.copy).catch(() => {});
    setCopied(post.id);
    setTimeout(() => setCopied(null), 1500);
    toast("Caption copied — now share it!", "info");
  };

  const share = (post: SponsoredPost) => {
    if (shared.includes(post.id) || busy) return;
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

      {!socialLinked && (
        <button
          onClick={() => nav("/profile")}
          className="mb-4 w-full rounded-2xl bg-amber-50 p-4 text-left text-sm font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
        >
          Tip: link your social accounts in Profile so posts verify instantly.
        </button>
      )}

      <div className="space-y-4">
        {SPONSORED_POSTS.map((post) => {
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
                  disabled={isShared || !!busy}
                  className={cn("btn mt-2 w-full py-3.5 text-white", isShared ? "bg-emerald-500" : "btn-primary")}
                >
                  {busy === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isShared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  {isShared ? "Posted & credited" : "I have performed this post"}
                </button>
              </div>
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
