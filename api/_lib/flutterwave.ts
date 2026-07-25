import { ENV } from "./env.js";

// Flutterwave client — used for the Nigerian bank list and account-name
// resolution (auto-fill the account holder's name from bank + account number).

export interface FlwBank {
  code: string;
  name: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __flwBanks: { at: number; banks: FlwBank[] } | undefined;
}

async function flwFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${ENV.FLW_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ENV.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: "error", message: text.slice(0, 200), _status: res.status };
  }
}

// Cached list of Nigerian banks (name + Flutterwave code). Cached 12h in the
// warm instance so we don't hit Flutterwave on every request.
export async function listBanks(): Promise<FlwBank[]> {
  if (!ENV.FLW_SECRET_KEY) return [];
  const cached = global.__flwBanks;
  if (cached && Date.now() - cached.at < 12 * 60 * 60 * 1000) return cached.banks;
  const data = await flwFetch("/v3/banks/NG");
  if (data?.status !== "success" || !Array.isArray(data.data)) return cached?.banks ?? [];
  const banks: FlwBank[] = data.data
    .map((b: any) => ({ code: String(b.code), name: String(b.name) }))
    .filter((b: FlwBank) => b.code && b.name)
    .sort((a: FlwBank, b: FlwBank) => a.name.localeCompare(b.name));
  global.__flwBanks = { at: Date.now(), banks };
  return banks;
}

export interface ResolveResult {
  ok: boolean;
  accountName?: string;
  message?: string;
}

// Resolve an account number against a bank code → account holder's name.
export async function resolveAccount(accountNumber: string, bankCode: string): Promise<ResolveResult> {
  if (!ENV.FLW_SECRET_KEY) return { ok: false, message: "Name lookup is not configured yet." };
  try {
    const data = await flwFetch("/v3/accounts/resolve", {
      method: "POST",
      body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
    });
    if (data?.status === "success" && data?.data?.account_name) {
      return { ok: true, accountName: String(data.data.account_name) };
    }
    return { ok: false, message: String(data?.message || "Could not verify this account.").slice(0, 160) };
  } catch (e: any) {
    return { ok: false, message: String(e?.message || e).slice(0, 160) };
  }
}
