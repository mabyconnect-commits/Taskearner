import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Copy, Check, Share2, Loader2, Megaphone, X, Download, ImagePlus, Sparkles, Users, Minus, Plus } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { ActivateGate } from "@/components/ActivateGate";
import { planById, SPONSORED_POSTS, SponsoredPost, PROMO_PRICE_PER_PERSON, PROMO_MIN_PEOPLE } from "@/lib/data";
import { api } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { compressImage, downloadDataUrl } from "@/lib/image";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const PLATFORMS = ["WhatsApp", "Facebook", "X", "Instagram", "TikTok"] as const;

export default function Sponsored() {
  const nav = useNavigate();
  const toast = useToast();
  const { plan, planActivated, socialLinked, earnActivity, completedPosts, mode, deposit, advertisePost, dailyUsed } = useStore();
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

  if (!planActivated) return <ActivateGate title="Sponsored Posts" />;

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
              {/* the shareable graphic: the admin's uploaded image, or a fallback banner */}
              {post.image ? (
                <img src={post.image} alt={post.headline} className="max-h-80 w-full bg-slate-100 object-contain dark:bg-black/30" />
              ) : (
                <div className="relative overflow-hidden bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-5 text-white">
                  <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-500/25 blur-2xl" />
                  <p className="font-display text-3xl font-extrabold leading-none text-brand-400">MILLIONS<br />DAILY!</p>
                  <p className="mt-2 max-w-[80%] text-xs text-white/70">{post.headline} — join Task Earner Africa and turn your voice into alerts. 💸</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">
                    ✓ Credit Alert · NGN 250,000.00
                  </div>
                </div>
              )}

              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400">Share on: <b className="text-slate-600 dark:text-slate-200">{post.platform.toUpperCase()}</b></p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">+{formatNaira(p.perPost, false)}</span>
                </div>
                <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">"{post.copy}"</p>
                {post.image && (
                  <button
                    onClick={() => { downloadDataUrl(post.image!, `taskearner-${post.id}.jpg`); toast("Image downloaded — post it with the caption!", "success"); }}
                    className="btn mt-3 w-full bg-ink-900 py-3 text-sm text-white dark:bg-white/10"
                  >
                    <Download className="h-4 w-4" /> Download image
                  </button>
                )}
                <button onClick={() => copy(post)} className="btn-ghost mt-2 w-full py-3 text-sm">
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
  onSubmit: (p: { headline: string; copy: string; platform: string; target: number; kind: "post" | "special"; image?: string }) => Promise<{ ok: boolean; msg: string }>;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"post" | "special">("post");
  const [headline, setHeadline] = useState("");
  const [copy, setCopy] = useState("");
  const [platform, setPlatform] = useState<string>("WhatsApp");
  const [people, setPeople] = useState(10);
  const [image, setImage] = useState<string>("");
  const [imgBusy, setImgBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const price = people * PROMO_PRICE_PER_PERSON;
  const special = mode === "special";

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

  const submit = async () => {
    if (headline.trim().length < 3) return toast(special ? "Give your task a title" : "Give your campaign a headline", "error");
    if (copy.trim().length < 10) return toast(special ? "Describe what you want us to do" : "Write the post content earners will share", "error");
    if (people < PROMO_MIN_PEOPLE) return toast(`Minimum ${PROMO_MIN_PEOPLE} people`, "error");
    if (price > deposit) return toast("Insufficient deposit. Fund your wallet first.", "error");
    setBusy(true);
    const res = await onSubmit({ headline: headline.trim(), copy: copy.trim(), platform, target: people, kind: mode, image: image || undefined });
    setBusy(false);
    toast(res.msg, res.ok ? "success" : "error");
    if (res.ok) onClose();
  };

  const setP = (v: number) => setPeople(Math.max(PROMO_MIN_PEOPLE, Math.min(5000, v)));

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-4xl bg-white dark:bg-ink-900 sm:max-h-[88vh] sm:rounded-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display text-xl font-extrabold">Promote with us 🚀</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 dark:bg-white/5"><X className="h-5 w-5" /></button>
        </div>

        {/* mode switch */}
        <div className="px-5 pt-3">
          <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
            <button onClick={() => setMode("post")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition", !special ? "bg-brand-500 text-slate-900 shadow" : "text-slate-500")}>
              <Megaphone className="h-4 w-4" /> Boost a Post
            </button>
            <button onClick={() => setMode("special")} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition", special ? "bg-brand-500 text-slate-900 shadow" : "text-slate-500")}>
              <Sparkles className="h-4 w-4" /> Special Task
            </button>
          </div>
        </div>

        {/* scrollable body */}
        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="rounded-2xl bg-brand-50 p-3 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
            {special
              ? "Tell us exactly what you want done — grow a page, run a poll, mass-share, gather sign-ups — and our team executes it for you."
              : "Real earners across Nigeria share your post. You only pay per person reached."}
          </p>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">{special ? "Task title" : "Headline"}</span>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="input" placeholder={special ? "e.g. Grow my Instagram followers" : "e.g. Grand opening this weekend"} maxLength={70} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">{special ? "What do you want us to do?" : "Post content"}</span>
            <textarea value={copy} onChange={(e) => setCopy(e.target.value)} className="input min-h-[90px] resize-none" placeholder={special ? "Describe the task, links, handles, and exactly what success looks like…" : "The exact caption earners will post…"} maxLength={400} />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">{special ? "Reference image (optional)" : "Flyer image (optional)"}</span>
            {image ? (
              <div className="relative overflow-hidden rounded-2xl">
                <img src={image} alt="preview" className="max-h-52 w-full bg-slate-100 object-contain dark:bg-black/30" />
                <button onClick={() => setImage("")} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-5 text-sm font-semibold text-slate-500 dark:border-white/10">
                {imgBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                {imgBusy ? "Processing…" : special ? "Add a reference image" : "Add a flyer earners can download"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
              </label>
            )}
          </div>

          {!special && (
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
          )}

          {/* people target */}
          <div>
            <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500"><Users className="h-4 w-4" /> How many people?</span>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
              <button onClick={() => setP(people - 5)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-soft dark:bg-white/10 dark:text-white"><Minus className="h-5 w-5" /></button>
              <div className="flex-1 text-center">
                <p className="font-display text-3xl font-extrabold leading-none">{people}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">people × {formatNaira(PROMO_PRICE_PER_PERSON, false)}</p>
              </div>
              <button onClick={() => setP(people + 5)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-soft dark:bg-white/10 dark:text-white"><Plus className="h-5 w-5" /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[10, 25, 50, 100, 250].map((v) => (
                <button key={v} onClick={() => setPeople(v)} className={cn("rounded-xl px-3 py-2 text-sm font-bold transition", people === v ? "bg-brand-500 text-slate-900" : "bg-slate-100 text-brand-600 dark:bg-white/5 dark:text-brand-300")}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* sticky pay footer */}
        <div className="border-t border-slate-100 p-4 dark:border-white/10">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400">Total to pay</p>
              <p className="font-display text-2xl font-extrabold">{formatNaira(price)}</p>
            </div>
            <p className="text-right text-[11px] font-semibold text-slate-400">
              {people} × {formatNaira(PROMO_PRICE_PER_PERSON, false)}<br />
              Deposit: {formatNaira(deposit)}
            </p>
          </div>
          <button onClick={submit} disabled={busy || price > deposit} className="btn-primary w-full py-4 text-lg disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : price > deposit ? "Fund wallet to continue" : `Pay ${formatNaira(price)} · Reach ${people}`}
          </button>
        </div>
      </div>
    </div>
  );
}

