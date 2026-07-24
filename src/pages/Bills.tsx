import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Smartphone, Wifi, Zap, Tv, Loader2, Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const CONFIG: Record<string, { title: string; icon: typeof Zap; fields: string; presets: number[]; providers: string[] }> = {
  airtime: { title: "Buy Airtime", icon: Smartphone, fields: "Phone number", presets: [100, 200, 500, 1000, 2000], providers: ["MTN", "Airtel", "Glo", "9mobile"] },
  data: { title: "Buy Data", icon: Wifi, fields: "Phone number", presets: [500, 1000, 2000, 3500, 5000], providers: ["MTN", "Airtel", "Glo", "9mobile"] },
  electricity: { title: "Pay Electricity", icon: Zap, fields: "Meter number", presets: [1000, 2000, 5000, 10000], providers: ["EKEDC", "IKEDC", "AEDC", "PHED"] },
  tv: { title: "TV Subscription", icon: Tv, fields: "Smartcard number", presets: [2950, 4400, 6200, 12500], providers: ["DStv", "GOtv", "Startimes"] },
};

export default function Bills() {
  const { type = "airtime" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { deposit, engagement, payBill } = useStore();
  const cfg = CONFIG[type] ?? CONFIG.airtime;

  const [provider, setProvider] = useState(cfg.providers[0]);
  const [target, setTarget] = useState("");
  const [amt, setAmt] = useState("");
  const [stage, setStage] = useState<"form" | "processing" | "done">("form");
  const n = Number(amt) || 0;
  const wallet = deposit + engagement;

  const pay = () => {
    if (!target.trim()) return toast(`Enter a valid ${cfg.fields.toLowerCase()}`, "error");
    if (n < 50) return toast("Enter an amount of at least ₦50", "error");
    if (n > wallet) return toast("Insufficient wallet balance", "error");
    setStage("processing");
    setTimeout(async () => {
      const res = await payBill({ amount: n, title: `${cfg.title}: ${provider} ${target}` });
      if (!res.ok) {
        toast(res.msg, "error");
        setStage("form");
        return;
      }
      setStage("done");
    }, 1200);
  };

  const Icon = cfg.icon;

  return (
    <Layout hideNav>
      <PageHeader title={cfg.title} subtitle="Instant & secure" to="/dashboard" />

      {stage === "done" ? (
        <div className="card mt-8 flex flex-col items-center p-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
            <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
          </div>
          <h2 className="mt-4 font-display text-2xl font-extrabold">Successful!</h2>
          <p className="mt-1 text-slate-400">{formatNaira(n)} {cfg.title.toLowerCase()} to {target} was successful.</p>
          <button onClick={() => nav("/dashboard")} className="btn-primary mt-6 w-full py-4">Back to Home</button>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-4 rounded-4xl bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 p-5 text-white shadow-card">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/20 text-brand-400"><Icon className="h-7 w-7" /></div>
            <div>
              <p className="text-sm text-white/70">Wallet balance</p>
              <p className="font-display text-2xl font-extrabold">{formatNaira(wallet)}</p>
            </div>
          </div>

          <div className="card space-y-4 p-5">
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-500">Provider</span>
              <div className="flex flex-wrap gap-2">
                {cfg.providers.map((pv) => (
                  <button key={pv} onClick={() => setProvider(pv)} className={cn("rounded-xl px-4 py-2.5 text-sm font-bold transition", provider === pv ? "bg-brand-500 text-slate-900" : "bg-slate-100 text-slate-500 dark:bg-white/5")}>
                    {pv}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-500">{cfg.fields}</span>
              <input value={target} onChange={(e) => setTarget(e.target.value)} className="input" placeholder={cfg.fields} inputMode="numeric" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-500">Amount</span>
              <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} className="input text-xl font-bold" placeholder="0" inputMode="numeric" />
            </label>
            <div className="flex flex-wrap gap-2">
              {cfg.presets.map((v) => (
                <button key={v} onClick={() => setAmt(String(v))} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-brand-600 dark:bg-white/5 dark:text-brand-300">
                  {formatNaira(v, false)}
                </button>
              ))}
            </div>
            <button onClick={pay} disabled={stage === "processing"} className="btn-primary w-full py-4 text-lg">
              {stage === "processing" ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${n ? formatNaira(n) : ""}`}
            </button>
          </div>
        </>
      )}
    </Layout>
  );
}
