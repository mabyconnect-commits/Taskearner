// Server-side source of truth for plan rates & pricing. The client must never
// be trusted for reward amounts — everything is computed here.
export type PlanId = "free" | "lite" | "starter" | "pro" | "elite" | "prime";

// How many words a single Word Game pays for (matches the client ROUNDS).
export const WORD_ROUNDS = 1;

export interface DailyCaps {
  voice: number; // sessions/day
  word: number; // games/day
  task: number; // tasks/day
  post: number; // sponsored posts/day
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  commission: number;
  perVoice: number;
  perWord: number;
  perPost: number;
  perTask: number;
  daily: DailyCaps;
  minWithdraw: number; // engagement-wallet minimum withdrawal for this plan
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", price: 0, commission: 0, perVoice: 40, perWord: 30, perPost: 25, perTask: 25, daily: { voice: 1, word: 1, task: 1, post: 1 }, minWithdraw: 8000 },
  lite: { id: "lite", name: "Voice Lite", price: 1500, commission: 850, perVoice: 100, perWord: 60, perPost: 50, perTask: 30, daily: { voice: 1, word: 1, task: 1, post: 1 }, minWithdraw: 8000 },
  starter: { id: "starter", name: "Voice Starter", price: 3000, commission: 1875, perVoice: 220, perWord: 140, perPost: 110, perTask: 60, daily: { voice: 1, word: 1, task: 1, post: 1 }, minWithdraw: 14500 },
  pro: { id: "pro", name: "Voice Pro", price: 5000, commission: 3100, perVoice: 380, perWord: 240, perPost: 180, perTask: 100, daily: { voice: 1, word: 1, task: 1, post: 1 }, minWithdraw: 22000 },
  elite: { id: "elite", name: "Audio Elite", price: 9500, commission: 6150, perVoice: 480, perWord: 320, perPost: 210, perTask: 130, daily: { voice: 1, word: 1, task: 1, post: 1 }, minWithdraw: 34000 },
  prime: { id: "prime", name: "Prime Artiste", price: 15000, commission: 10200, perVoice: 600, perWord: 400, perPost: 250, perTask: 150, daily: { voice: 1, word: 1, task: 1, post: 1 }, minWithdraw: 45000 },
};

export function planOf(id: string): Plan {
  return PLANS[(id as PlanId)] ?? PLANS.free;
}

// Maximum a plan can earn in a single day (the "expected daily funds").
export function dailyMax(p: Plan): number {
  return (
    p.daily.voice * p.perVoice +
    p.daily.word * p.perWord * WORD_ROUNDS +
    p.daily.task * p.perTask +
    p.daily.post * p.perPost
  );
}

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export const WITHDRAW_MIN = 45000; // engagement wallet (fallback / highest tier)
export const SALES_WITHDRAW_MIN = 1000; // sales/affiliate wallet — flat for all plans

// Referral wallet: ₦250 for each signup, held as pending until the downline
// either completes REFERRAL_CONFIRM_TASKS voice/sponsored activities OR upgrades
// to a paid plan — then it becomes available (withdrawable).
export const REFERRAL_BONUS = 250;
export const REFERRAL_CONFIRM_TASKS = 25;
export const REFERRAL_WITHDRAW_MIN = 5000;

// Taxes & fees
export const DEPOSIT_TAX_RATE = 0.08; // 8% added on top of the funded amount
export const WITHDRAW_TAX_RATE = 0.035; // 3.5% deducted from every withdrawal
export const WITHDRAW_VAT = 50; // flat ₦50 VAT per withdrawal

// 8% tax charged on top of the amount the user wants credited to their wallet.
export function depositTax(base: number): number {
  return Math.round(base * DEPOSIT_TAX_RATE);
}
export function depositTotal(base: number): number {
  return base + depositTax(base);
}
// 3.5% tax + ₦50 VAT deducted from a withdrawal; the user receives the net.
export function withdrawFee(amount: number): number {
  return Math.round(amount * WITHDRAW_TAX_RATE) + WITHDRAW_VAT;
}
export function withdrawNet(amount: number): number {
  return Math.max(0, amount - withdrawFee(amount));
}

export const COOLDOWN_MS = 60 * 1000;
