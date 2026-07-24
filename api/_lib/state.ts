import { sql, num } from "./db";
import { HttpError } from "./http";
import { planOf, dailyMax, utcDay } from "./plans";
import { ENV } from "./env";

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

export function serializeUser(u: any, bank?: any): UserState {
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
  return serializeUser(u, bank);
}

export function reference(prefix = "tx"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
