import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { ToastProvider } from "@/components/ui/Toast";

import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Earn from "@/pages/Earn";
import VoiceEarn from "@/pages/VoiceEarn";
import WordGame from "@/pages/WordGame";
import Tasks from "@/pages/Tasks";
import Sponsored from "@/pages/Sponsored";
import Sales from "@/pages/Sales";
import WalletPage from "@/pages/WalletPage";
import Deposit from "@/pages/Deposit";
import Packages from "@/pages/Packages";
import Profile from "@/pages/Profile";
import Transactions from "@/pages/Transactions";
import Leaderboard from "@/pages/Leaderboard";
import Notifications from "@/pages/Notifications";
import Bills from "@/pages/Bills";

function Protected({ children }: { children: JSX.Element }) {
  const authed = useStore((s) => s.authed);
  const loc = useLocation();
  if (!authed) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/earn" element={<Protected><Earn /></Protected>} />
        <Route path="/earn/voice" element={<Protected><VoiceEarn /></Protected>} />
        <Route path="/earn/word-game" element={<Protected><WordGame /></Protected>} />
        <Route path="/earn/tasks" element={<Protected><Tasks /></Protected>} />
        <Route path="/earn/sponsored" element={<Protected><Sponsored /></Protected>} />
        <Route path="/sales" element={<Protected><Sales /></Protected>} />
        <Route path="/wallet" element={<Protected><WalletPage /></Protected>} />
        <Route path="/deposit" element={<Protected><Deposit /></Protected>} />
        <Route path="/packages" element={<Protected><Packages /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
        <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/bills/:type" element={<Protected><Bills /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
