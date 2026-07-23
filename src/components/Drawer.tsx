import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  X, Home, Coins, Receipt, Wallet, ArrowUpCircle, Crown, Users, Trophy, Bell, User,
  Sun, Moon, Send, MessageCircle, LogOut,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/cn";

const links = [
  { label: "Home", icon: Home, to: "/dashboard" },
  { label: "Earn", icon: Coins, to: "/earn" },
  { label: "Transactions", icon: Receipt, to: "/transactions" },
  { label: "Fund Wallet", icon: Wallet, to: "/deposit" },
  { label: "Withdraw", icon: ArrowUpCircle, to: "/wallet" },
  { label: "Plans & Upgrade", icon: Crown, to: "/packages" },
  { label: "Affiliate", icon: Users, to: "/sales" },
  { label: "Top Affiliates", icon: Trophy, to: "/leaderboard" },
  { label: "Notifications", icon: Bell, to: "/notifications" },
  { label: "Profile", icon: User, to: "/profile" },
];

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const { name, username, theme, setTheme, logout } = useStore();

  const go = (to: string) => {
    onClose();
    nav(to);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-[71] flex w-[82%] max-w-sm flex-col bg-white p-5 shadow-2xl dark:bg-[#100b16]"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xl font-bold text-white">
                {name ? name[0].toUpperCase() : "V"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold">{name || "New Earner"}</p>
                <p className="truncate text-sm text-slate-400">@{username || "guest"}</p>
              </div>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 dark:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-1.5 dark:bg-white/5">
              <span className="pl-3 text-sm font-semibold text-slate-500">Appearance</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition",
                    theme === "light" ? "bg-brand-500 text-white shadow" : "text-slate-500",
                  )}
                >
                  <Sun className="h-4 w-4" /> Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition",
                    theme === "dark" ? "bg-brand-500 text-white shadow" : "text-slate-500",
                  )}
                >
                  <Moon className="h-4 w-4" /> Dark
                </button>
              </div>
            </div>

            <nav className="no-scrollbar mt-3 flex-1 space-y-0.5 overflow-y-auto py-2">
              {links.map(({ label, icon: Icon, to }) => (
                <button
                  key={label}
                  onClick={() => go(to)}
                  className="flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left font-semibold text-slate-700 transition hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <Icon className="h-6 w-6 text-brand-500" strokeWidth={2.1} />
                  {label}
                </button>
              ))}
            </nav>

            <div className="space-y-2 pt-2">
              <a
                className="btn w-full bg-sky-500 py-3 text-white"
                href="https://t.me/taskearning101"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Send className="h-4 w-4" /> Telegram Channel
              </a>
              <a
                className="btn-ghost w-full py-3"
                href="https://t.me/taskearning101"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-4 w-4" /> Community Group
              </a>
              <button
                onClick={() => {
                  logout();
                  onClose();
                  nav("/");
                }}
                className="btn w-full bg-rose-50 py-3 text-rose-600 dark:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
