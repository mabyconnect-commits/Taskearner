import { createPortal } from "react-dom";
import { ArrowLeft, Share2, Check, Loader2, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { WithdrawReceipt as Receipt } from "@/store/useStore";
import { formatNaira, maskAccount } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const STATUS: Record<string, { label: string; tone: string; icon: typeof Check }> = {
  success: { label: "Paid", tone: "text-emerald-500", icon: Check },
  processing: { label: "Processing", tone: "text-amber-500", icon: Loader2 },
  pending: { label: "Processing", tone: "text-amber-500", icon: Clock },
};

export function WithdrawReceipt({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const toast = useToast();
  const st = STATUS[receipt.status] ?? STATUS.pending;
  const StatusIcon = st.icon;
  const date = new Date(receipt.ts).toLocaleString("en-NG", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const share = async () => {
    const text =
      `TaskEarner Africa — Withdrawal Receipt\n` +
      `Amount: ${formatNaira(receipt.amount)}\n` +
      `You receive: ${formatNaira(receipt.net)} (fee ${formatNaira(receipt.fee)})\n` +
      `Bank: ${receipt.bankName} · ${receipt.accountNumber}\n` +
      `Status: ${st.label}\n` +
      `Reference: ${receipt.reference}\n` +
      `Date: ${date}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Withdrawal Receipt", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast("Receipt copied to clipboard", "success");
      }
    } catch {
      /* user cancelled share */
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-50 dark:bg-ink-950">
      {/* header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-ink-950/90">
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-extrabold">Receipt</h1>
        <button onClick={share} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto max-w-md px-4 pb-10">
        <p className="mt-6 flex items-center justify-center gap-2 text-center font-display text-lg font-bold text-emerald-600 dark:text-emerald-400">
          <Check className="h-5 w-5" /> Withdrawal request submitted!
        </p>

        {/* branded receipt card */}
        <div className="mt-5 overflow-hidden rounded-4xl shadow-card">
          <div className="relative bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-7 text-center text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="flex justify-center"><Logo onDark markClass="h-8 w-8" showTagline={false} /></div>
            <div className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full bg-white/15">
              <StatusIcon className={cn("h-9 w-9 text-white", receipt.status === "processing" && "animate-spin")} strokeWidth={2.5} />
            </div>
            <p className="mt-4 font-display text-5xl font-extrabold">{formatNaira(receipt.amount)}</p>
            <p className={cn("mt-1 font-semibold", "text-white/70")}>{st.label}</p>
          </div>

          {/* perforation */}
          <div className="relative h-0">
            <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-slate-50 dark:bg-ink-950" />
            <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-slate-50 dark:bg-ink-950" />
          </div>

          <div className="space-y-0 bg-white p-6 dark:bg-white/[0.04]">
            <RowKV k="Recipient" v={receipt.accountName} />
            <RowKV k="Bank" v={receipt.bankName} />
            <RowKV k="Account Number" v={maskAccount(receipt.accountNumber)} />
            <RowKV k="Wallet" v={receipt.wallet === "sales" ? "Sales" : "Engagement"} />
            <RowKV k="Amount" v={formatNaira(receipt.amount)} />
            <RowKV k="Tax + VAT" v={`-${formatNaira(receipt.fee)}`} tone="text-rose-500" />
            <RowKV k="You receive" v={formatNaira(receipt.net)} tone="text-emerald-600 dark:text-emerald-400" strong />
            <RowKV k="Status" v={st.label} tone={st.tone} strong />
            <RowKV k="Reference" v={receipt.reference} mono />
            <RowKV k="Date Requested" v={date} last />
          </div>

          <div className="bg-white px-6 pb-6 text-center dark:bg-white/[0.04]">
            <p className="text-xs text-slate-400">TaskEarner Africa · Your tasks, your earnings</p>
            <p className="text-xs text-slate-400">This is an electronic receipt for your withdrawal request.</p>
          </div>
        </div>

        <button onClick={onClose} className="btn-primary mt-6 w-full py-4 text-lg">
          <ArrowLeft className="h-5 w-5" /> Back to Wallet
        </button>
      </div>
    </div>,
    document.body,
  );
}

function RowKV({ k, v, tone, strong, mono, last }: { k: string; v: string; tone?: string; strong?: boolean; mono?: boolean; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3.5", !last && "border-b border-dashed border-slate-100 dark:border-white/5")}>
      <span className="shrink-0 text-sm text-slate-400">{k}</span>
      <span className={cn("text-right font-bold", strong ? "font-display text-lg" : "text-sm", mono && "font-mono text-xs", tone || "text-slate-800 dark:text-white")}>{v}</span>
    </div>
  );
}
