import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStore } from "@/store/useStore";
import { useToast } from "@/components/ui/Toast";

export default function Security() {
  const nav = useNavigate();
  const toast = useToast();
  const { changePassword, mode } = useStore();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (mode === "online" && !current) return toast("Enter your current password", "error");
    if (next.length < 6) return toast("New password must be at least 6 characters", "error");
    if (next !== confirm) return toast("New passwords do not match", "error");
    setBusy(true);
    const res = await changePassword({ currentPassword: current, newPassword: next });
    setBusy(false);
    toast(res.msg, res.ok ? "success" : "error");
    if (res.ok) {
      setCurrent(""); setNext(""); setConfirm("");
      nav("/profile");
    }
  };

  return (
    <Layout>
      <PageHeader title="Password & Security" subtitle="Change your password" to="/profile" />

      <div className="dotted card space-y-4 p-5">
        <Field label="Current Password" value={current} onChange={setCurrent} show={show} placeholder="Enter current password" />
        <Field label="New Password" value={next} onChange={setNext} show={show} placeholder="At least 6 characters" />
        <Field label="Confirm New Password" value={confirm} onChange={setConfirm} show={show} placeholder="Re-enter new password" />

        <button onClick={() => setShow((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-300">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {show ? "Hide passwords" : "Show passwords"}
        </button>

        <button onClick={submit} disabled={busy} className="btn-primary w-full py-4 text-lg">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Lock className="h-5 w-5" /> Update Password</>}
        </button>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-3xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          Use a strong, unique password. Never share it, and never place withdrawals through unofficial channels.
        </p>
      </div>
    </Layout>
  );
}

function Field({ label, value, onChange, show, placeholder }: { label: string; value: string; onChange: (v: string) => void; show: boolean; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-500">{label}</span>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}
