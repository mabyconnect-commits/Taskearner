import { useState } from "react";
import { ArrowUp, Landmark, Plus, Clock, Building2, Check, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useStore } from "@/store/useStore";
import { SALES_WITHDRAW_MIN, planById, withdrawFee, withdrawNet, WITHDRAW_TAX_RATE, WITHDRAW_VAT } from "@/lib/data";
import { formatNaira, timeAgo, maskAccount, maskName } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const BANKS = ["Access Bank", "GTBank", "Zenith Bank", "UBA", "First Bank", "Kuda", "Opay", "Moniepoint", "Wema Bank"];

export default function WalletPage() {
  const toast = useToast();
  const { engagement, sales, bank, addBank, withdraw, transactions, plan } = useStore();
  const [tab, setTab] = useState<"engagement" | "sales">("engagement");
  const [bankSheet, setBankSheet] = useState(false);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const balance = tab === "engagement" ? engagement : sales;
  // Engagement minimum depends on the active plan; sales is flat for all plans.
  const minWithdraw = tab === "sales" ? SALES_WITHDRAW_MIN : planById(plan).minWithdraw;
  const amtNum = Number(amt) || 0;
  const fee = amtNum > 0 ? withdrawFee(amtNum) : 0;
  const net = amtNum > 0 ? withdrawNet(amtNum) : 0;
  const payouts = transactions.filter((t) => t.type === "withdraw");
  const totalWithdrawn = payouts.reduce((s, t) => s + Math.abs(t.amount), 0);

  const submitWithdraw = async () => {
    if (busy) return;
    setBusy(true);
    const res = await withdraw(tab, Number(amt) || 0);
    setBusy(false);
    toast(res.msg, res.ok ? "success" : "error");
    if (res.ok) setAmt("");
  };

  return (
    <Layout>
      <PageHeader
        title="Withdraw funds"
        subtitle="Get paid to your bank account"
        to="/dashboard"
        right={
          <button onClick={() => setBankSheet(true)} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
            <Plus className="h-5 w-5" />
          </button>
        }
      />

      {/* total withdrawn */}
      <div className="overflow-hidden rounded-4xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-6 text-white shadow-card">
        <p className="flex items-center gap-2 text-sm text-white/70">
          <ArrowUp className="h-4 w-4" /> Total withdrawn all-time
        </p>
        <p className="mt-2 font-display text-4xl font-extrabold">{formatNaira(totalWithdrawn)}</p>
      </div>

      {/* wallet tabs */}
      <div className="mt-5 flex rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
        {(["engagement", "sales"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-xl py-3 text-sm font-bold capitalize transition",
              tab === t ? "bg-brand-500 text-slate-900 shadow" : "text-slate-500",
            )}
          >
            {t} wallet
          </button>
        ))}
      </div>

      {/* balance */}
      <div className="mt-6 text-center">
        <p className="text-sm font-semibold capitalize text-slate-400">{tab} balance</p>
        <p className="font-display text-5xl font-extrabold">{formatNaira(balance)}</p>
        <p className="mt-1 text-sm text-slate-400">Minimum: {formatNaira(minWithdraw)}</p>
      </div>

      {/* bank / withdraw */}
      {bank ? (
        <>
          <div className="card mt-6 flex items-center gap-3 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{maskName(bank.accountName)}</p>
              <p className="truncate text-sm text-slate-400">{bank.bankName} · {maskAccount(bank.accountNumber)}</p>
            </div>
            <button onClick={() => setBankSheet(true)} className="shrink-0 text-sm font-bold text-brand-700 dark:text-brand-300">Change</button>
          </div>

          <div className="card mt-4 p-5">
            <label className="block text-sm font-semibold text-slate-500">Amount to withdraw</label>
            <input
              inputMode="numeric"
              value={amt}
              onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))}
              className="input mt-2 text-center text-3xl font-extrabold"
              placeholder="0"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setAmt(String(minWithdraw))} className="btn-ghost py-3 text-sm">
                Min · {formatNaira(minWithdraw, false)}
              </button>
              <button onClick={() => setAmt(String(Math.floor(balance)))} className="btn-ghost py-3 text-sm">
                Max · {formatNaira(balance, false)}
              </button>
            </div>
            {amtNum > 0 && (
              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Amount</span>
                  <span className="font-semibold">{formatNaira(amtNum)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Tax ({(WITHDRAW_TAX_RATE * 100).toFixed(1)}%) + {formatNaira(WITHDRAW_VAT)} VAT</span>
                  <span className="font-semibold text-rose-500">-{formatNaira(fee)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 dark:border-white/10">
                  <span className="font-semibold text-slate-500">You receive</span>
                  <span className="font-display text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatNaira(net)}</span>
                </div>
              </div>
            )}
            <button onClick={submitWithdraw} disabled={busy || Number(amt) <= 0} className="btn-primary mt-4 w-full py-4 text-lg">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ArrowUp className="h-5 w-5" /> Request Withdrawal</>}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">Minimum {formatNaira(minWithdraw)} · {(WITHDRAW_TAX_RATE * 100).toFixed(1)}% tax + {formatNaira(WITHDRAW_VAT)} VAT · Payout within 24h</p>
          </div>
        </>
      ) : (
        <div className="card mt-6 flex flex-col items-center p-6 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-100 dark:bg-amber-500/20">
            <Landmark className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="mt-3 font-display text-xl font-bold">Add your bank account</h3>
          <p className="mt-1 text-sm text-slate-400">You need a payout bank before you can withdraw.</p>
          <button onClick={() => setBankSheet(true)} className="btn-primary mt-4 w-full py-3.5">
            <Plus className="h-5 w-5" /> Add Bank Account
          </button>
        </div>
      )}

      {/* recent payouts */}
      <h2 className="mb-3 mt-7 font-display text-xl font-bold">Recent payouts</h2>
      {payouts.length === 0 ? (
        <div className="card flex flex-col items-center p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
            <Clock className="h-8 w-8 text-brand-500" />
          </div>
          <p className="mt-3 text-slate-400">No withdrawal history yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payouts.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft dark:bg-white/[0.04]">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20">
                <Check className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold">{t.title}</p>
                <p className="text-xs text-slate-400">{timeAgo(t.ts)} · {t.wallet}</p>
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-200">{formatNaira(t.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <BankSheet open={bankSheet} onClose={() => setBankSheet(false)} onSave={async (b) => { const r = await addBank(b); toast(r.msg, r.ok ? "success" : "error"); if (r.ok) setBankSheet(false); }} banks={BANKS} />
    </Layout>
  );
}

function BankSheet({ open, onClose, onSave, banks }: { open: boolean; onClose: () => void; onSave: (b: { bankName: string; accountNumber: string; accountName: string }) => void; banks: string[] }) {
  const toast = useToast();
  const [bankName, setBankName] = useState(banks[0]);
  const [acct, setAcct] = useState("");
  const [name, setName] = useState("");

  const acctError = acct.length > 0 && acct.length !== 10;

  const submit = () => {
    if (acct.length !== 10) return toast("Account number must be exactly 10 digits", "error");
    if (!name.trim()) return toast("Enter the account name", "error");
    onSave({ bankName, accountNumber: acct, accountName: name.trim() });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add bank account">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-500">Bank</span>
          <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="input">
            {banks.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Account number</span>
            <span className={cn("text-xs font-semibold", acctError ? "text-rose-500" : "text-slate-400")}>{acct.length}/10</span>
          </div>
          <input
            inputMode="numeric"
            maxLength={10}
            value={acct}
            onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))}
            className={cn("input", acctError && "border-rose-400 focus:border-rose-400 focus:ring-rose-100")}
            placeholder="0123456789"
          />
          {acctError && <span className="mt-1 block text-xs font-medium text-rose-500">Nigerian account numbers are 10 digits.</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-500">Account name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Amara Okeke" />
        </label>
        <button onClick={submit} className="btn-primary w-full py-4">
          Save bank account
        </button>
      </div>
    </Sheet>
  );
}
