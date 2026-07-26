import { ReactNode } from "react";
import { LifeBuoy } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { TG_SUPPORT_BOT } from "@/components/JoinTelegram";

export function Layout({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className="mx-auto min-h-full max-w-md">
      <main className={`page-enter px-5 pt-5 ${hideNav ? "pb-8" : "pb-32"}`}>{children}</main>
      {!hideNav && (
        <>
          {/* floating "message support" → opens the Telegram support bot */}
          <a
            href={TG_SUPPORT_BOT}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with Support"
            className="fixed bottom-28 left-[max(16px,calc(50%-224px+16px))] z-30 flex items-center gap-2 rounded-full bg-ink-900 py-3 pl-3.5 pr-4 text-sm font-bold text-white shadow-glow transition active:scale-90 dark:bg-white/10"
          >
            <LifeBuoy className="h-5 w-5 text-brand-400" /> Support
          </a>
          <BottomNav />
        </>
      )}
    </div>
  );
}
