import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mic, Mail, Lock, User as UserIcon, ArrowLeft } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useToast } from "@/components/ui/Toast";

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signup" | "login">(params.get("mode") === "login" ? "login" : "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signup, login } = useStore();
  const nav = useNavigate();
  const toast = useToast();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      if (!name.trim()) return toast("Please enter your name", "error");
      if (!email.includes("@")) return toast("Enter a valid email", "error");
      signup({ name, email });
      toast(`Welcome to Voicearn, ${name.split(" ")[0]}! 🎉`);
    } else {
      login();
      toast("Welcome back! 👋");
    }
    nav("/dashboard");
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-10 pt-14">
      <Link to="/" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <div className="mt-8 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-white shadow-glow">
          <Mic className="h-6 w-6" />
        </div>
        <span className="font-display text-2xl font-extrabold">Voicearn</span>
      </div>

      <h1 className="mt-8 font-display text-3xl font-extrabold">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-slate-400">
        {mode === "signup" ? "Join thousands earning with their voice." : "Log in to keep earning."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <Field icon={<UserIcon className="h-5 w-5" />} label="Full name">
            <input className="input pl-11" placeholder="Matthew Adeleye" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        <Field icon={<Mail className="h-5 w-5" />} label="Email">
          <input className="input pl-11" placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field icon={<Lock className="h-5 w-5" />} label="Password">
          <input className="input pl-11" placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <button className="btn-primary w-full py-4 text-lg">
          {mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-slate-500">
        {mode === "signup" ? "Already have an account?" : "New to Voicearn?"}{" "}
        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="font-bold text-brand-600 dark:text-brand-300"
        >
          {mode === "signup" ? "Log in" : "Sign up"}
        </button>
      </p>

      <p className="mt-auto pt-8 text-center text-xs text-slate-400">
        Demo app · This is a UI prototype. No real payments are processed.
      </p>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-500">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        {children}
      </div>
    </label>
  );
}
