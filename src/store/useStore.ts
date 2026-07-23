import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PlanId, planById, WITHDRAW_MIN } from "@/lib/data";

export type TxType = "voice" | "word" | "task" | "post" | "fund" | "withdraw" | "plan" | "commission" | "bill";

export interface Transaction {
  id: string;
  type: TxType;
  title: string;
  amount: number; // positive = credit, negative = debit
  wallet: "engagement" | "sales" | "deposit";
  ts: number;
}

export interface Bank {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface Referral {
  id: string;
  name: string;
  plan: PlanId;
  status: "activated" | "pending";
  ts: number;
}

interface State {
  onboarded: boolean;
  authed: boolean;
  name: string;
  username: string;
  email: string;
  phone: string;
  theme: "light" | "dark";
  plan: PlanId;

  engagement: number; // earnings from activities
  sales: number; // affiliate commissions
  deposit: number; // funds to activate/upgrade plans

  bank: Bank | null;
  socialLinked: boolean;
  transactions: Transaction[];
  referrals: Referral[];
  completedTasks: string[];
  cooldowns: Record<string, number>; // activity id -> timestamp available again

  // actions
  signup: (p: { name: string; email: string }) => void;
  login: () => void;
  logout: () => void;
  toggleTheme: () => void;
  setTheme: (t: "light" | "dark") => void;

  earn: (p: { type: TxType; title: string; amount: number }) => void;
  fund: (amount: number) => void;
  withdraw: (wallet: "engagement" | "sales", amount: number) => { ok: boolean; msg: string };
  activatePlan: (id: PlanId) => { ok: boolean; msg: string };
  addBank: (b: Bank) => void;
  linkSocial: () => void;
  completeTask: (id: string, reward: number, title: string) => void;
  setCooldown: (id: string, ms: number) => void;
  simulateReferral: () => void;
  updateProfile: (p: Partial<Pick<State, "name" | "phone" | "email" | "username">>) => void;
  payBill: (p: { amount: number; title: string }) => { ok: boolean; msg: string };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function tx(type: TxType, title: string, amount: number, wallet: Transaction["wallet"]): Transaction {
  return { id: uid(), type, title, amount, wallet, ts: Date.now() };
}

const seedTx: Transaction[] = [];

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      onboarded: false,
      authed: false,
      name: "",
      username: "",
      email: "",
      phone: "",
      theme: "light",
      plan: "free",

      engagement: 0,
      sales: 0,
      deposit: 0,

      bank: null,
      socialLinked: false,
      transactions: seedTx,
      referrals: [],
      completedTasks: [],
      cooldowns: {},

      signup: ({ name, email }) => {
        const first = name.trim().split(" ")[0] || "Star";
        set({
          authed: true,
          onboarded: true,
          name: name.trim(),
          email,
          username: first.toLowerCase().replace(/[^a-z0-9]/g, "") + Math.floor(Math.random() * 90 + 10),
        });
      },
      login: () => set({ authed: true, onboarded: true }),
      logout: () => set({ authed: false }),

      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setTheme: (t) => set({ theme: t }),

      earn: ({ type, title, amount }) =>
        set((s) => ({
          engagement: s.engagement + amount,
          transactions: [tx(type, title, amount, "engagement"), ...s.transactions].slice(0, 60),
        })),

      fund: (amount) =>
        set((s) => ({
          deposit: s.deposit + amount,
          transactions: [tx("fund", "Wallet funding (MevonPay)", amount, "deposit"), ...s.transactions].slice(0, 60),
        })),

      withdraw: (wallet, amount) => {
        const s = get();
        if (!s.bank) return { ok: false, msg: "Add a payout bank account first." };
        const bal = wallet === "engagement" ? s.engagement : s.sales;
        if (amount < WITHDRAW_MIN) return { ok: false, msg: `Minimum withdrawal is ₦${WITHDRAW_MIN.toLocaleString()}.` };
        if (amount > bal) return { ok: false, msg: "Insufficient balance in this wallet." };
        set((st) => ({
          [wallet]: bal - amount,
          transactions: [tx("withdraw", `Withdrawal to ${s.bank!.bankName}`, -amount, wallet), ...st.transactions].slice(0, 60),
        }) as Partial<State>);
        return { ok: true, msg: "Withdrawal request submitted. Payout in 24h." };
      },

      activatePlan: (id) => {
        const s = get();
        const plan = planById(id);
        const current = planById(s.plan);
        if (id === s.plan) return { ok: false, msg: "This plan is already active." };
        if (plan.price <= current.price && s.plan !== "free")
          return { ok: false, msg: "You can only upgrade to a higher plan." };
        const cost = plan.price - (s.plan === "free" ? 0 : current.price);
        if (s.deposit < cost) return { ok: false, msg: "Insufficient deposit balance. Fund your wallet first." };
        set((st) => ({
          deposit: st.deposit - cost,
          plan: id,
          transactions: [tx("plan", `Activated ${plan.name} plan`, -cost, "deposit"), ...st.transactions].slice(0, 60),
        }));
        return { ok: true, msg: `${plan.name} activated. Pay once, earn forever!` };
      },

      addBank: (b) => set({ bank: b }),
      linkSocial: () => set({ socialLinked: true }),

      completeTask: (id, reward, title) =>
        set((s) => {
          if (s.completedTasks.includes(id)) return s;
          return {
            completedTasks: [...s.completedTasks, id],
            engagement: s.engagement + reward,
            transactions: [tx("task", title, reward, "engagement"), ...s.transactions].slice(0, 60),
          };
        }),

      setCooldown: (id, ms) => set((s) => ({ cooldowns: { ...s.cooldowns, [id]: Date.now() + ms } })),

      simulateReferral: () =>
        set((s) => {
          const plan = planById(s.plan).id === "free" ? "lite" : s.plan;
          const commission = planById(plan).commission;
          const names = ["Ada Obi", "Emeka N.", "Bola A.", "Chidi K.", "Ngozi U.", "Tunde F."];
          return {
            sales: s.sales + commission,
            referrals: [
              { id: uid(), name: names[Math.floor(Math.random() * names.length)], plan, status: "activated" as const, ts: Date.now() },
              ...s.referrals,
            ],
            transactions: [tx("commission", "Referral commission", commission, "sales"), ...s.transactions].slice(0, 60),
          };
        }),

      updateProfile: (p) => set(p),

      payBill: ({ amount, title }) => {
        const s = get();
        // bills are paid from engagement first, then deposit
        if (amount > s.engagement + s.deposit) return { ok: false, msg: "Insufficient wallet balance." };
        const fromEngagement = Math.min(amount, s.engagement);
        const fromDeposit = amount - fromEngagement;
        set((st) => ({
          engagement: st.engagement - fromEngagement,
          deposit: st.deposit - fromDeposit,
          transactions: [tx("bill", title, -amount, "engagement"), ...st.transactions].slice(0, 60),
        }));
        return { ok: true, msg: "Payment successful." };
      },
    }),
    {
      name: "voicearn-store",
      version: 1,
    },
  ),
);
