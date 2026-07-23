import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  right,
  to = -1,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  to?: string | number;
}) {
  const nav = useNavigate();
  return (
    <div className="sticky top-0 z-30 -mx-5 mb-5 border-b border-slate-100 bg-slate-50/85 px-5 py-4 backdrop-blur-lg dark:border-white/5 dark:bg-[#0b0710]/85">
      <div className="flex items-center gap-3">
        <button
          onClick={() => (typeof to === "number" ? nav(to) : nav(to))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition active:scale-90 dark:bg-white/10 dark:text-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-slate-400 dark:text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
