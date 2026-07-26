import { useEffect, useState } from "react";
import { Send, MessageCircle, Users } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";

// Community + support links (kept in sync with the drawer).
export const TG_CHANNEL = "https://t.me/taskearning101";
export const TG_GROUP = "https://t.me/+ABIZY4MltSdmNzI5";
export const TG_SUPPORT_BOT = "https://t.me/TaskEarnerSupportBot";

const SEEN_KEY = "te_tg_prompt_v1";

function open(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

// One-time popup nudging new users to join the Telegram channel + group. Shows
// once (until dismissed/joined), then never nags again — the permanent card
// below stays available for everyone.
export function TelegramPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = !!localStorage.getItem(SEEN_KEY); } catch { /* ignore */ }
    if (seen) return;
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <Sheet open={show} onClose={dismiss}>
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-sky-500/15">
          <Send className="h-10 w-10 text-sky-500" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold">Join the TaskEarner community</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500 dark:text-slate-400">
          Get payment proofs, daily earning drops, important updates and fast support. Don't miss out — join now!
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            onClick={() => { open(TG_CHANNEL); dismiss(); }}
            className="btn w-full bg-sky-500 py-3.5 text-white"
          >
            <Send className="h-5 w-5" /> Join our Channel
          </button>
          <button
            onClick={() => { open(TG_GROUP); dismiss(); }}
            className="btn w-full bg-sky-500/10 py-3.5 text-sky-600 dark:text-sky-300"
          >
            <MessageCircle className="h-5 w-5" /> Join the Community Group
          </button>
          <button onClick={dismiss} className="w-full py-2 text-sm font-semibold text-slate-400">
            Maybe later
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// Permanent, always-available Telegram join card for the dashboard.
export function TelegramCard() {
  return (
    <div className="mt-4 overflow-hidden rounded-4xl bg-gradient-to-br from-sky-500 to-sky-600 p-5 text-white shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20">
          <Send className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">Join us on Telegram</p>
          <p className="text-sm text-white/80">Payment proofs, updates & support</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button onClick={() => open(TG_CHANNEL)} className="btn bg-white py-3 text-sky-600">
          <Send className="h-4 w-4" /> Channel
        </button>
        <button onClick={() => open(TG_GROUP)} className="btn bg-white/15 py-3 text-white">
          <Users className="h-4 w-4" /> Group
        </button>
      </div>
    </div>
  );
}
