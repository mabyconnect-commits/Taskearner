import { NavLink } from "react-router-dom";
import { Home, Gem, Users, Wallet, User } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/earn", label: "Earn", icon: Gem },
  { to: "/sales", label: "Sales", icon: Users },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-center justify-between rounded-[26px] border border-black/5 bg-white/90 px-2 py-2 shadow-[0_8px_40px_-8px_rgba(17,12,46,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-[#160f1f]/90">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="relative flex flex-1 flex-col items-center gap-1 py-1.5"
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "grid h-10 w-14 place-items-center rounded-2xl transition-all",
                    isActive ? "bg-brand-500 text-slate-900 shadow-glow" : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold transition-colors",
                    isActive ? "text-brand-600 dark:text-brand-300" : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
