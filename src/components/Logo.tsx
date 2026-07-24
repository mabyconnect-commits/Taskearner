import { cn } from "@/lib/cn";

/** The mic mark inside a yellow disc (self-contained; also used for favicon). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Task Earner">
      <circle cx="32" cy="32" r="32" fill="#f5c518" />
      {/* mic body + stand in warm black */}
      <g fill="#141109">
        <rect x="23" y="13" width="18" height="28" rx="9" />
        <path d="M18 30a2.4 2.4 0 0 1 4.8 0 9.2 9.2 0 0 0 18.4 0 2.4 2.4 0 0 1 4.8 0 14 14 0 0 1-11.6 13.8V47h4.2a2.3 2.3 0 0 1 0 4.6H25.4a2.3 2.3 0 0 1 0-4.6h4.2v-3.2A14 14 0 0 1 18 30z" />
      </g>
      {/* T + downward arrow cut out of the mic in yellow */}
      <g fill="none" stroke="#f5c518" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M26 20.5h12" />
        <path d="M32 20.5v10" />
        <path d="M27.5 26.5 32 31l4.5-4.5" />
      </g>
    </svg>
  );
}

/** Full lockup: mark + "TaskEarner" wordmark, optional Africa pill + tagline. */
export function Logo({
  className,
  markClass = "h-9 w-9",
  showAfrica = true,
  showTagline = false,
  onDark = false,
}: {
  className?: string;
  markClass?: string;
  showAfrica?: boolean;
  showTagline?: boolean;
  onDark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={cn(markClass, "shrink-0")} />
      <div className="leading-none">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-sans text-2xl font-extrabold tracking-tight",
              onDark ? "text-white" : "text-slate-900",
            )}
          >
            Task<span className={onDark ? "text-brand-400" : "text-brand-600"}>Earner</span>
          </span>
          {showAfrica && (
            <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-900">
              Africa
            </span>
          )}
        </div>
        {showTagline && (
          <p className={cn("mt-1 text-xs font-semibold", onDark ? "text-white/60" : "text-slate-500")}>
            Your tasks. Your <span className="text-brand-500">earnings.</span>
          </p>
        )}
      </div>
    </div>
  );
}
