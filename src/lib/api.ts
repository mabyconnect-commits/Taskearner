// Typed client for the Task Earner Africa backend.
const BASE = "/api";
const TOKEN_KEY = "te_token";

let token = "";
try {
  token = localStorage.getItem(TOKEN_KEY) || "";
} catch {
  /* localStorage unavailable */
}

export function setToken(t: string) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
export function getToken() {
  return token;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as any)?.error || "Request failed", res.status);
  return data as T;
}

export interface ServerUser {
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
  bank: { bankName: string; accountNumber: string; accountName: string } | null;
  dailyMax: number;
  dailyEarned: number;
  dailyCaps: { voice: number; word: number; task: number; post: number };
  dailyUsed: { voice: number; word: number; task: number; post: number };
}

export const api = {
  health: () => req("/health"),
  signup: (b: { name: string; email: string; password: string; ref?: string }) => req("/auth/signup", "POST", b),
  login: (b: { email: string; password: string }) => req("/auth/login", "POST", b),
  me: () => req<{ user: ServerUser; transactions: any[]; referrals: any[] }>("/me"),
  updateProfile: (b: { name?: string; phone?: string; email?: string }) => req("/profile", "PATCH", b),
  linkSocial: () => req("/profile/social", "POST"),
  changePassword: (b: { currentPassword: string; newPassword: string }) => req("/profile/password", "POST", b),
  addBank: (b: { bankName: string; accountNumber: string; accountName: string }) => req("/bank", "POST", b),
  earn: (b: { kind: string; refId?: string; count?: number }) => req("/earn", "POST", b),
  activate: (b: { planId: string }) => req("/plans/activate", "POST", b),
  fundInitiate: (b: { amount: number }) => req("/fund/initiate", "POST", b),
  fundVerify: (b: { reference: string }) => req("/fund/verify", "POST", b),
  withdraw: (b: { wallet: string; amount: number }) => req("/withdraw", "POST", b),
  payBill: (b: { amount: number; title: string }) => req("/bills/pay", "POST", b),
  transactions: () => req<{ transactions: any[] }>("/transactions"),
  referrals: () => req<{ referrals: any[] }>("/referrals"),
};
