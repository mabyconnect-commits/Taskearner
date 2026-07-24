import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Rocket, Info, Wallet, ChevronRight, Loader2, Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useStore } from "@/store/useStore";
import { depositTax, depositTotal, DEPOSIT_TAX_RATE } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const PRESETS = [1500, 3000, 5000, 9500, 15000];

export default function Deposit() {
  const nav = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { deposit, fund, verifyFund } = useStore();
  const [amt, setAmt] = useState("");
  const [pay, setPay] = useState(false);
  const [stage, setStage] = useState<"pay" | "processing" | "done">("pay");
  const n = Number(amt) || 0;
  const tax = depositTax(n);
  const total = depositTotal(n);

  // Handle the redirect back from NekPay: /deposit?ref=<reference>
  useEffect(() => {
    const ref = params.get("ref");
    if (!ref) return;
    (async () => {
      const res = await verifyFund(ref);
      toast(res.ok ? "Payment confirmed — wallet funded! 🎉" : res.msg, res.ok ? "success" : "error");
      params.delete("ref");
      setParams(params, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPay = () => {
    if (n < 100) return toast("Enter at least ₦100", "error");
    setStage("pay");
    setPay(true);
  };

  const confirm = async () => {
    setStage("processing");
    const res = await fund(n);
    if (!res.ok) {
      toast(res.msg, "error");
      setStage("pay");
      return;
    }
    setStage("done");
  };

  return (
    <Layout>
      <PageHeader title="Fund Wallet" subtitle="Add money to your wallet" to="/dashboard" />

      <div className="overflow-hidden rounded-4xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-6 text-white shadow-card">
        <p className="text-sm text-white/60">Deposit Balance</p>
        <p className="mt-1 font-display text-4xl font-extrabold">{formatNaira(deposit)}</p>
        <p className="mt-1 text-sm text-white/50">Use this to activate or upgrade your plan</p>
      </div>

      <div className="card mt-5 p-5">
        <h2 className="font-display text-xl font-bold">How much do you want to add?</h2>
        <label className="mt-4 block text-sm font-semibold text-slate-500">Amount</label>
        <input
          inputMode="numeric"
          value={amt}
          onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))}
          className="input mt-1.5 text-center text-3xl font-extrabold"
          placeholder="0"
        />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {PRESETS.map((v) => (
            <button
              key={v}
              onClick={() => setAmt(String(v))}
              className={cn(
                "rounded-2xl border-2 py-3 font-bold transition",
                n === v ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/20" : "border-slate-100 text-brand-600 dark:border-white/10 dark:text-brand-300",
              )}
            >
              {formatNaira(v, false)}
            </button>
          ))}
        </div>
        <button onClick={startPay} className="btn-primary mt-5 w-full py-4 text-lg">
          <Plus className="h-5 w-5" /> Continue
        </button>
      </div>

      <button onClick={() => nav("/packages")} className="mt-4 flex w-full items-center gap-4 rounded-3xl bg-brand-50 p-5 text-left dark:bg-brand-500/10">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-slate-900">
          <Rocket className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="font-bold">Ready to earn more?</p>
          <p className="text-sm text-slate-500 dark:text-slate-300">Use your deposit balance to activate a plan</p>
        </div>
        <ChevronRight className="h-5 w-5 text-brand-400" />
      </button>

      <div className="mt-4 flex gap-3 rounded-3xl bg-slate-100 p-4 dark:bg-white/5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your deposit balance is used to activate or upgrade plans. Withdrawals are made from your Engagement and Sales balances.
        </p>
      </div>

      <Sheet open={pay} onClose={() => stage !== "processing" && setPay(false)} title={stage === "done" ? undefined : "Confirm payment"}>
        {stage === "pay" && (
          <div>
            <div className="space-y-2.5 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Wallet credit</span>
                <span className="font-semibold">{formatNaira(n)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Tax ({Math.round(DEPOSIT_TAX_RATE * 100)}%)</span>
                <span className="font-semibold">{formatNaira(tax)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-white/10">
                <span className="font-semibold text-slate-500">Total to pay</span>
                <span className="font-display text-2xl font-extrabold">{formatNaira(total)}</span>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
              <Wallet className="h-4 w-4" /> {formatNaira(n)} lands in your wallet · {formatNaira(tax)} tax
            </p>
            <button onClick={confirm} className="btn-primary mt-4 w-full py-4">Pay {formatNaira(total)}</button>
          </div>
        )}
        {stage === "processing" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
            <p className="mt-4 font-semibold">Processing payment…</p>
          </div>
        )}
        {stage === "done" && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
            </div>
            <h3 className="mt-4 font-display text-2xl font-extrabold">Wallet funded!</h3>
            <p className="mt-1 text-slate-400">{formatNaira(n)} added to your deposit balance.</p>
            <div className="mt-6 flex w-full gap-3">
              <button onClick={() => { setPay(false); setAmt(""); }} className="btn-ghost flex-1 py-3.5">Done</button>
              <button onClick={() => nav("/packages")} className="btn-primary flex-1 py-3.5">Activate a plan</button>
            </div>
          </div>
        )}
      </Sheet>
    </Layout>
  );
}
