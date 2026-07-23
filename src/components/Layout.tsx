import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function Layout({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className="mx-auto min-h-full max-w-md">
      <main className={`page-enter px-5 pt-5 ${hideNav ? "pb-8" : "pb-32"}`}>{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
