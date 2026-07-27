import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";

// Shown on earning screens until the user activates a plan (Free is ₦0 but must
// still be activated explicitly — it's no longer auto-on).
export function ActivateGate({ title }: { title: string }) {
  const nav = useNavigate();
  return (
    <Layout hideNav>
      <PageHeader title={title} to="/earn" />
      <div className="card mt-10 flex flex-col items-center p-8 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-100 dark:bg-brand-500/20">
          <Rocket className="h-10 w-10 text-brand-500" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold">Activate a plan first</h2>
        <p className="mt-1 text-slate-400">Activate the <b>Free</b> plan (₦0) to earn ₦120/day, or a paid plan to earn more.</p>
        <button onClick={() => nav("/packages")} className="btn-primary mt-6 w-full py-4">Choose a plan</button>
      </div>
    </Layout>
  );
}
