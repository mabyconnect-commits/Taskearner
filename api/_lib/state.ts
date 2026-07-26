import { sql, num } from "./db.js";
import { HttpError } from "./http.js";
import { planOf, dailyMax, utcDay } from "./plans.js";
import { ENV } from "./env.js";

export interface Bank {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface UserState {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  plan: string;
  socialLinked: boolean;
  engagement: number;
  sales: number;
  deposit: number;
  referral: number;        // available (confirmed) referral-wallet balance
  referralPending: number; // ₦ still pending (downline hasn't qualified yet)
  referralCount: number;   // total referrals
  completed: { tasks: string[]; posts: string[] };
  cooldowns: Record<string, number>;
  bank: Bank | null;
  // daily earning limits for the user's plan
  dailyMax: number;
  dailyEarned: number;
  dailyCaps: { voice: number; word: number; task: number; post: number };
  dailyUsed: { voice: number; word: number; task: number; post: number };
  isAdmin: boolean;
}

export function isAdminEmail(email: string): boolean {
  return ENV.ADMIN_EMAILS.includes(String(email || "").toLowerCase());
}

export function serializeUser(u: any, bank?: any, referralStats?: { pending?: number; count?: number }): UserState {
  const plan = planOf(u.plan);
  const today = utcDay();
  const rawDaily = u.daily ?? {};
  const fresh = rawDaily.date === today;
  const used = {
    voice: fresh ? rawDaily.voice ?? 0 : 0,
    word: fresh ? rawDaily.word ?? 0 : 0,
    task: fresh ? rawDaily.task ?? 0 : 0,
    post: fresh ? rawDaily.post ?? 0 : 0,
  };
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    phone: u.phone,
    plan: u.plan,
    socialLinked: u.social_linked,
    engagement: num(u.engagement),
    sales: num(u.sales),
    deposit: num(u.deposit),
    referral: num(u.referral),
    referralPending: referralStats?.pending ?? 0,
    referralCount: referralStats?.count ?? 0,
    completed: u.completed ?? { tasks: [], posts: [] },
    cooldowns: u.cooldowns ?? {},
    bank: bank
      ? { bankName: bank.bank_name, accountNumber: bank.account_number, accountName: bank.account_name }
      : null,
    dailyMax: dailyMax(plan),
    dailyEarned: fresh ? num(rawDaily.earned) : 0,
    dailyCaps: plan.daily,
    dailyUsed: used,
    isAdmin: isAdminEmail(u.email),
  };
}

export async function loadState(uid: string): Promise<UserState> {
  const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
  if (!u) throw new HttpError("User not found", 404);
  const [bank] = await sql`SELECT * FROM banks WHERE user_id = ${uid}`;
  const [rs] = await sql`
    SELECT
      COALESCE(sum(bonus) FILTER (WHERE bonus_status = 'pending'), 0) AS pending,
      count(*)::int AS count
    FROM referrals WHERE referrer_id = ${uid}`;
  return serializeUser(u, bank, { pending: num(rs?.pending), count: rs?.count ?? 0 });
}

export function reference(prefix = "tx"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
