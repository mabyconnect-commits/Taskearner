import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PlanId, planById, planDailyMax, SALES_WITHDRAW_MIN, REFERRAL_WITHDRAW_MIN, COOLDOWN_MS, withdrawFee, withdrawNet } from "@/lib/data";
import { api, ApiError, getToken, setToken, ServerUser } from "@/lib/api";

export type TxType = "voice" | "word" | "task" | "post" | "fund" | "withdraw" | "plan" | "commission" | "bill";
export type ActivityKind = "voice" | "word" | "task" | "post";
export type Mode = "online" | "offline";
export interface WithdrawReceipt {
  reference: string;
  amount: number; // gross
  fee: number;
  net: number;
  wallet: "engagement" | "sales" | "referral";
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string; // pending | processing | success
  ts: number;
}
export type Result = { ok: boolean; msg: string; amount?: number; receipt?: WithdrawReceipt };

export interface Transaction {
  id: string;
  type: TxType;
  title: string;
  amount: number;
  wallet: "engagement" | "sales" | "deposit" | "referral";
  status?: string;
  ts: number;
}
export interface Bank {
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountName: string;
}
export interface Referral {
  id: string;
  name: string;
  plan: PlanId;
  status: "activated" | "pending";
  commission?: number;
  ts: number;
}

interface State {
  booting: boolean;
  mode: Mode;
  authed: boolean;
  isAdmin: boolean;
  name: string;
  username: string;
  email: string;
  phone: string;
  theme: "light" | "dark";
  plan: PlanId;
  planActivated: boolean;
  engagement: number;
  sales: number;
  deposit: number;
  referral: number;
  referralPending: number;
  referralCount: number;
  bank: Bank | null;
  socialLinked: boolean;
  transactions: Transaction[];
  referrals: Referral[];
  completedTasks: string[];
  completedPosts: string[];
  cooldowns: Record<string, number>;
  dailyDate: string;
  dailyEarned: number;
  dailyUsed: { voice: number; word: number; task: number; post: number };

  boot: () => Promise<void>;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;

  signup: (p: { name: string; email: string; password: string; ref?: string }) => Promise<Result>;
  login: (p: { email: string; password: string }) => Promise<Result>;
  logout: () => void;

  earnActivity: (kind: ActivityKind, refId?: string, count?: number) => Promise<Result>;
  fund: (amount: number) => Promise<Result>;
  verifyFund: (reference: string) => Promise<Result>;
  reconcileDeposits: () => Promise<void>;
  withdraw: (wallet: "engagement" | "sales" | "referral", amount: number) => Promise<Result>;
  activatePlan: (id: PlanId) => Promise<Result>;
  addBank: (b: Bank) => Promise<Result>;
  linkSocial: () => Promise<Result>;
  changePassword: (p: { currentPassword: string; newPassword: string }) => Promise<Result>;
  updateProfile: (p: { name?: string; phone?: string; email?: string }) => Promise<Result>;
  payBill: (p: { amount: number; title: string }) => Promise<Result>;
  advertisePost: (p: { headline: string; copy: string; platform: string; budget: number; image?: string }) => Promise<Result>;
  refresh: () => Promise<void>;
  simulateReferral: () => Promise<Result>;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function tx(type: TxType, title: string, amount: number, wallet: Transaction["wallet"]): Transaction {
  return { id: uid(), type, title, amount, wallet, ts: Date.now() };
}
function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : "Network error. Please try again.";
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      // Map a server user object into store state.
      const applyUser = (user: ServerUser, transactions?: any[], referrals?: any[]) => {
        set((s) => ({
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          isAdmin: !!user.isAdmin,
          plan: user.plan as PlanId,
          planActivated: !!user.planActivated,
          socialLinked: user.socialLinked,
          engagement: user.engagement,
          sales: user.sales,
          deposit: user.deposit,
          referral: user.referral ?? 0,
          referralPending: user.referralPending ?? 0,
          referralCount: user.referralCount ?? 0,
          bank: user.bank,
          completedTasks: user.completed?.tasks ?? [],
          completedPosts: user.completed?.posts ?? [],
          cooldowns: user.cooldowns ?? {},
          dailyDate: todayKey(),
          dailyEarned: user.dailyEarned ?? 0,
          dailyUsed: user.dailyUsed ?? { voice: 0, word: 0, task: 0, post: 0 },
          transactions: transactions ? mapTx(transactions) : s.transactions,
          referrals: referrals ? mapRefs(referrals) : s.referrals,
        }));
      };
      const mapTx = (rows: any[]): Transaction[] =>
        rows.map((t) => ({ id: t.id, type: t.type, title: t.title, amount: t.amount, wallet: t.wallet, status: t.status, ts: t.ts }));
      const mapRefs = (rows: any[]): Referral[] =>
        rows.map((r) => ({ id: r.id, name: r.name, plan: r.plan, status: r.status, commission: r.commission, ts: r.ts }));

      const online = () => get().mode === "online";

      return {
        booting: true,
        mode: "offline",
        authed: false,
        isAdmin: false,
        name: "",
        username: "",
        email: "",
        phone: "",
        theme: "light",
        plan: "free",
        planActivated: false,
        engagement: 0,
        sales: 0,
        deposit: 0,
        referral: 0,
        referralPending: 0,
        referralCount: 0,
        bank: null,
        socialLinked: false,
        transactions: [],
        referrals: [],
        completedTasks: [],
        completedPosts: [],
        cooldowns: {},
        dailyDate: todayKey(),
        dailyEarned: 0,
        dailyUsed: { voice: 0, word: 0, task: 0, post: 0 },

        boot: async () => {
          let mode: Mode = "offline";
          try {
            await api.health();
            mode = "online";
          } catch {
            mode = "offline";
          }
          if (mode === "online") {
            if (getToken()) {
              try {
                const { user, transactions, referrals } = await api.me();
                applyUser(user, transactions, referrals);
                set({ mode, authed: true, booting: false });
                // Credit any paid-but-pending deposits (safety net for missed callbacks).
                get().reconcileDeposits();
                return;
              } catch {
                setToken("");
              }
            }
            set({ mode, authed: false, booting: false });
          } else {
            // offline: keep persisted local state as-is
            set({ mode, booting: false });
          }
        },

        setTheme: (t) => set({ theme: t }),
        toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

        signup: async ({ name, email, password, ref }) => {
          if (online()) {
            try {
              const { token, user } = await api.signup({ name, email, password, ref });
              setToken(token);
              applyUser(user);
              set({ authed: true });
              // load lists
              try {
                const me = await api.me();
                applyUser(me.user, me.transactions, me.referrals);
              } catch { /* ignore */ }
              return { ok: true, msg: "Account created" };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          // offline
          const first = name.trim().split(" ")[0] || "Earner";
          set({
            authed: true,
            name: name.trim(),
            email,
            username: first.toLowerCase().replace(/[^a-z0-9]/g, "") + Math.floor(Math.random() * 9000 + 1000),
          });
          return { ok: true, msg: "Account created" };
        },

        login: async ({ email, password }) => {
          if (online()) {
            try {
              const { token, user } = await api.login({ email, password });
              setToken(token);
              applyUser(user);
              set({ authed: true });
              try {
                const me = await api.me();
                applyUser(me.user, me.transactions, me.referrals);
              } catch { /* ignore */ }
              return { ok: true, msg: "Welcome back" };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          set({ authed: true });
          return { ok: true, msg: "Welcome back" };
        },

        logout: () => {
          setToken("");
          set({ authed: false, isAdmin: false });
        },

        refresh: async () => {
          if (!online()) return;
          try {
            const me = await api.me();
            applyUser(me.user, me.transactions, me.referrals);
          } catch { /* ignore */ }
        },

        earnActivity: async (kind, refId, count) => {
          if (online()) {
            try {
              const r = await api.earn({ kind, refId, count });
              applyUser(r.user, r.transactions);
              return { ok: true, msg: "Earned", amount: r.amount };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          // offline
          const s = get();
          const p = planById(s.plan); // free plan earns too now
          const now = Date.now();

          // daily usage (reset on new day)
          const day = todayKey();
          const fresh = s.dailyDate === day;
          const used = fresh ? { ...s.dailyUsed } : { voice: 0, word: 0, task: 0, post: 0 };
          const earnedToday = fresh ? s.dailyEarned : 0;
          if (used[kind] >= p.daily[kind]) return { ok: false, msg: "You've reached today's limit for this activity." };

          let amount = 0;
          let title = "";
          let type: TxType = kind;
          const cooldowns = { ...s.cooldowns };
          if (kind === "voice") {
            if ((cooldowns.voice ?? 0) > now) return { ok: false, msg: "Cooling down" };
            amount = p.perVoice; title = "Voice Earn session completed"; cooldowns.voice = now + COOLDOWN_MS;
          } else if (kind === "word") {
            if ((cooldowns.word ?? 0) > now) return { ok: false, msg: "Cooling down" };
            amount = p.perWord * Math.max(1, count ?? 1); title = "Word Game completed"; cooldowns.word = now + COOLDOWN_MS;
          } else if (kind === "task") {
            if (!refId || s.completedTasks.includes(refId)) return { ok: false, msg: "Already done" };
            amount = p.perTask; title = "Daily task completed"; type = "task";
          } else {
            if (!refId || s.completedPosts.includes(refId)) return { ok: false, msg: "Already shared" };
            amount = p.perPost; title = "Sponsored post shared"; type = "post";
          }

          // enforce the plan's daily earning ceiling
          const remaining = Math.max(0, planDailyMax(p) - earnedToday);
          if (remaining <= 0) return { ok: false, msg: "You've reached today's earning limit for your plan." };
          amount = Math.min(amount, remaining);
          used[kind] += 1;

          set((st) => ({
            engagement: st.engagement + amount,
            cooldowns,
            dailyDate: day,
            dailyEarned: earnedToday + amount,
            dailyUsed: used,
            completedTasks: kind === "task" && refId ? [...st.completedTasks, refId] : st.completedTasks,
            completedPosts: kind === "post" && refId ? [...st.completedPosts, refId] : st.completedPosts,
            transactions: [tx(type, title, amount, "engagement"), ...st.transactions].slice(0, 60),
          }));
          return { ok: true, msg: "Earned", amount };
        },

        fund: async (amount) => {
          if (online()) {
            try {
              const init: any = await api.fundInitiate({ amount });
              if (init.instant) {
                const r: any = await api.fundVerify({ reference: init.reference });
                applyUser(r.user, r.transactions);
                return { ok: true, msg: "Wallet funded" };
              }
              window.location.href = init.authorizationUrl;
              return { ok: true, msg: "Redirecting to NekPay…" };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          set((s) => ({
            deposit: s.deposit + amount,
            transactions: [tx("fund", "Wallet funding (NekPay)", amount, "deposit"), ...s.transactions].slice(0, 60),
          }));
          return { ok: true, msg: "Wallet funded" };
        },

        reconcileDeposits: async () => {
          if (!online()) return;
          try {
            const r: any = await api.reconcileDeposits();
            applyUser(r.user, r.transactions);
          } catch { /* ignore */ }
        },

        verifyFund: async (reference) => {
          if (!online()) return { ok: false, msg: "Offline" };
          try {
            const r: any = await api.fundVerify({ reference });
            if (r.status === "success") {
              applyUser(r.user, r.transactions);
              return { ok: true, msg: "Wallet funded" };
            }
            return { ok: false, msg: "Payment not completed yet" };
          } catch (e) {
            return { ok: false, msg: errMsg(e) };
          }
        },

        withdraw: async (wallet, amount) => {
          if (online()) {
            try {
              const r: any = await api.withdraw({ wallet, amount });
              applyUser(r.user, r.transactions);
              return { ok: true, msg: "Withdrawal submitted. Payout within 24h.", receipt: r.receipt };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          const s = get();
          if (!s.bank) return { ok: false, msg: "Add a payout bank account first." };
          const bal = wallet === "engagement" ? s.engagement : wallet === "referral" ? s.referral : s.sales;
          const min = wallet === "sales" ? SALES_WITHDRAW_MIN : wallet === "referral" ? REFERRAL_WITHDRAW_MIN : planById(s.plan).minWithdraw;
          if (amount < min) return { ok: false, msg: `Minimum withdrawal is ₦${min.toLocaleString()}.` };
          if (amount > bal) return { ok: false, msg: "Insufficient balance in this wallet." };
          // 3.5% tax + ₦50 VAT come off the payout; wallet is debited the gross.
          const fee = withdrawFee(amount);
          const net = withdrawNet(amount);
          const reference = `WD-${wallet === "sales" ? "S" : wallet === "referral" ? "R" : "E"}-${Date.now()}-${Math.floor(Math.random() * 90000 + 10000)}`;
          const t = tx("withdraw", `Withdrawal to ${s.bank!.bankName} · ₦${net.toLocaleString()} net (₦${fee.toLocaleString()} fee)`, -amount, wallet);
          t.status = "pending";
          set((st) => ({
            [wallet]: bal - amount,
            transactions: [t, ...st.transactions].slice(0, 60),
          }) as Partial<State>);
          const receipt: WithdrawReceipt = {
            reference, amount, fee, net, wallet,
            bankName: s.bank!.bankName, accountNumber: s.bank!.accountNumber, accountName: s.bank!.accountName,
            status: "pending", ts: t.ts,
          };
          return { ok: true, msg: `Withdrawal submitted. You'll receive ₦${net.toLocaleString()} within 24h.`, receipt };
        },

        activatePlan: async (id) => {
          if (online()) {
            try {
              const r: any = await api.activate({ planId: id });
              applyUser(r.user, r.transactions);
              return { ok: true, msg: `${planById(id).name} activated. Pay once, earn forever!` };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          const s = get();
          const plan = planById(id);
          const current = planById(s.plan);
          // Free activation: no cost, just switch earning on.
          if (id === "free") {
            if (s.planActivated && s.plan === "free") return { ok: false, msg: "Your Free plan is already active." };
            if (s.plan !== "free") return { ok: false, msg: "You're already on a paid plan." };
            set({ planActivated: true });
            return { ok: true, msg: "Free plan activated — start earning ₦120/day!" };
          }
          if (id === s.plan) return { ok: false, msg: "This plan is already active." };
          if (plan.price <= current.price && s.plan !== "free") return { ok: false, msg: "You can only upgrade to a higher plan." };
          const cost = plan.price - (s.plan === "free" ? 0 : current.price);
          if (s.deposit < cost) return { ok: false, msg: "Insufficient deposit balance. Fund your wallet first." };
          set((st) => ({
            deposit: st.deposit - cost,
            plan: id,
            planActivated: true,
            transactions: [tx("plan", `Activated ${plan.name} plan`, -cost, "deposit"), ...st.transactions].slice(0, 60),
          }));
          return { ok: true, msg: `${plan.name} activated. Pay once, earn forever!` };
        },

        addBank: async (b) => {
          if (online()) {
            try {
              const r: any = await api.addBank(b);
              applyUser(r.user);
              return { ok: true, msg: "Bank account saved!" };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          set({ bank: b });
          return { ok: true, msg: "Bank account saved!" };
        },

        linkSocial: async () => {
          if (online()) {
            try {
              const r: any = await api.linkSocial();
              applyUser(r.user);
              return { ok: true, msg: "Social accounts linked!" };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          set({ socialLinked: true });
          return { ok: true, msg: "Social accounts linked!" };
        },

        changePassword: async (p) => {
          if (online()) {
            try {
              await api.changePassword(p);
              return { ok: true, msg: "Password updated successfully!" };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          // offline demo has no stored password
          return { ok: true, msg: "Password updated successfully!" };
        },

        updateProfile: async (p) => {
          if (online()) {
            try {
              const r: any = await api.updateProfile(p);
              applyUser(r.user);
              return { ok: true, msg: "Profile updated!" };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          set(p);
          return { ok: true, msg: "Profile updated!" };
        },

        payBill: async ({ amount, title }) => {
          if (online()) {
            try {
              const r: any = await api.payBill({ amount, title });
              applyUser(r.user, r.transactions);
              return { ok: true, msg: "Payment successful." };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          const s = get();
          if (amount > s.engagement + s.deposit) return { ok: false, msg: "Insufficient wallet balance." };
          const fromEng = Math.min(amount, s.engagement);
          const fromDep = amount - fromEng;
          set((st) => ({
            engagement: st.engagement - fromEng,
            deposit: st.deposit - fromDep,
            transactions: [tx("bill", title, -amount, "engagement"), ...st.transactions].slice(0, 60),
          }));
          return { ok: true, msg: "Payment successful." };
        },

        advertisePost: async ({ headline, copy, platform, budget, image }) => {
          if (online()) {
            try {
              const r: any = await api.applySponsored({ headline, copy, platform, budget, image });
              applyUser(r.user, r.transactions);
              return { ok: true, msg: "Campaign submitted! It goes live after review." };
            } catch (e) {
              return { ok: false, msg: errMsg(e) };
            }
          }
          // offline demo: just deduct from deposit
          const s = get();
          if (budget < SALES_WITHDRAW_MIN) return { ok: false, msg: `Minimum campaign budget is ₦${SALES_WITHDRAW_MIN.toLocaleString()}.` };
          if (s.deposit < budget) return { ok: false, msg: "Insufficient deposit balance. Fund your wallet first." };
          set((st) => ({
            deposit: st.deposit - budget,
            transactions: [tx("plan", `Sponsored post: ${headline}`, -budget, "deposit"), ...st.transactions].slice(0, 60),
          }));
          return { ok: true, msg: "Campaign submitted! It goes live after review." };
        },

        simulateReferral: async () => {
          if (online()) return { ok: false, msg: "Referrals activate when your invitees buy a plan." };
          const s = get();
          const plan = planById(s.plan).id === "free" ? "lite" : s.plan;
          const commission = planById(plan).commission;
          const names = ["Ada Obi", "Emeka N.", "Bola A.", "Chidi K.", "Ngozi U.", "Tunde F."];
          set((st) => ({
            sales: st.sales + commission,
            referrals: [
              { id: uid(), name: names[Math.floor(Math.random() * names.length)], plan, status: "activated" as const, commission, ts: Date.now() },
              ...st.referrals,
            ],
            transactions: [tx("commission", "Referral commission", commission, "sales"), ...st.transactions].slice(0, 60),
          }));
          return { ok: true, msg: "New referral activated a plan! 💰" };
        },
      };
    },
    {
      name: "taskearner-store",
      version: 2,
      partialize: (s) => ({
        // only persist client-only + offline-simulation data
        theme: s.theme,
        authed: s.mode === "offline" ? s.authed : false,
        name: s.name,
        username: s.username,
        email: s.email,
        phone: s.phone,
        plan: s.plan,
        engagement: s.engagement,
        sales: s.sales,
        deposit: s.deposit,
        bank: s.bank,
        socialLinked: s.socialLinked,
        transactions: s.transactions,
        referrals: s.referrals,
        completedTasks: s.completedTasks,
        completedPosts: s.completedPosts,
        cooldowns: s.cooldowns,
        dailyDate: s.dailyDate,
        dailyEarned: s.dailyEarned,
        dailyUsed: s.dailyUsed,
      }),
    },
  ),
);
