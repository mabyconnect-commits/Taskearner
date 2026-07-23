import { sql, num } from "./db";
import { HttpError } from "./http";

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
}

export function serializeUser(u: any, bank?: any): UserState {
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
