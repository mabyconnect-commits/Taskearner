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
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e: any) {
    // fetch itself failed (offline / DNS / CORS)
    throw new ApiError(`Network error: ${String(e?.message || e).slice(0, 120)}`, 0);
  }

  // Read as text first so we can surface non-JSON error pages (timeouts,
  // firewall blocks, etc.) instead of a useless generic message.
  const raw = await res.text().catch(() => "");
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }

  if (!res.ok) {
    if (data && data.error) throw new ApiError(String(data.error), res.status);
    // Strip HTML tags from platform error pages, keep it short and readable.
    const snippet = (raw || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    throw new ApiError(`HTTP ${res.status}${snippet ? " — " + snippet : " (empty response)"}`, res.status);
  }
  return (data ?? {}) as T;
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
  isAdmin: boolean;
}

export interface ServerTask {
  id: string;
  title: string;
  detail: string;
  category: string;
  link: string;
}

export interface ServerSponsored {
  id: string;
  headline: string;
  copy: string;
  platform: string;
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
  banksList: () => req<{ banks: { code: string; name: string }[] }>("/banks/list"),
  resolveBankName: (b: { bankCode: string; accountNumber: string }) => req<{ accountName: string }>("/bank/resolve", "POST", b),
  earn: (b: { kind: string; refId?: string; count?: number }) => req("/earn", "POST", b),
  activate: (b: { planId: string }) => req("/plans/activate", "POST", b),
  fundInitiate: (b: { amount: number }) => req("/fund/initiate", "POST", b),
  fundVerify: (b: { reference: string }) => req("/fund/verify", "POST", b),
  reconcileDeposits: () => req("/deposits/reconcile", "POST"),
  withdraw: (b: { wallet: string; amount: number }) => req("/withdraw", "POST", b),
  payBill: (b: { amount: number; title: string }) => req("/bills/pay", "POST", b),
  transactions: () => req<{ transactions: any[] }>("/transactions"),
  referrals: () => req<{ referrals: any[] }>("/referrals"),
  leaderboard: () => req<{ leaderboard: { name: string; handle: string; earned: number; refs: number }[] }>("/leaderboard"),

  // Marketplace (live tasks + sponsored feeds, and user-paid campaign apply)
  tasks: () => req<{ tasks: ServerTask[] }>("/tasks"),
  sponsored: () => req<{ sponsored: ServerSponsored[] }>("/sponsored"),
  applySponsored: (b: { headline: string; copy: string; platform: string; budget: number }) =>
    req("/sponsored/apply", "POST", b),

  // Admin
  adminOverview: () => req<{ overview: any }>("/admin/overview"),
  adminBalance: () => req<{ ok: boolean; balance: number; provider: string; error?: string }>("/admin/balance"),
  adminUsers: (q = "") => req<{ users: any[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  adminTransactions: () => req<{ transactions: any[] }>("/admin/transactions"),
  adminDeposits: () => req<{ deposits: any[] }>("/admin/deposits"),
  adminDepositAction: (b: { id: string; action: "credit" | "fail" }) => req("/admin/deposits/action", "POST", b),
  adminDepositQuery: (b: { id: string }) => req<{ reference: string; detectedPaid: boolean; amount: number; raw?: string; error?: string }>("/admin/deposits/query", "POST", b),
  adminPayouts: () => req<{ payouts: any[] }>("/admin/payouts"),
  adminPayoutAction: (b: { id: string; action: "approve" | "reject" | "retry" }) => req("/admin/payouts/action", "POST", b),
  adminTasks: () => req<{ tasks: any[] }>("/admin/tasks"),
  adminCreateTask: (b: { title: string; detail: string; category: string; link?: string }) =>
    req("/admin/tasks", "POST", b),
  adminTaskAction: (b: { id: string; action: "enable" | "disable" | "delete" }) => req("/admin/tasks/action", "POST", b),
  adminSponsored: () => req<{ sponsored: any[] }>("/admin/sponsored"),
  adminCreateSponsored: (b: { headline: string; copy: string; platform: string; budget?: number }) =>
    req("/admin/sponsored", "POST", b),
  adminSponsoredAction: (b: { id: string; action: "approve" | "reject" | "end" }) =>
    req("/admin/sponsored/action", "POST", b),
};
