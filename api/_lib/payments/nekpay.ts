import crypto from "node:crypto";
import { ENV } from "../env.js";
import {
  CallbackResult, CreateOrderInput, CreateOrderResult, PaymentProvider, PayoutInput, PayoutResult, QueryOrderResult,
} from "./types.js";

// ── MD5 signing (§3) ─────────────────────────────────────────────────────────
function sign(params: Record<string, string | number | undefined | null>, key: string): string {
  const filtered = Object.entries(params)
    .filter(([k]) => !["sign", "sign_type", "signType"].includes(k))
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== "")
    .map(([k, v]) => [k, String(v)] as [string, string]);
  filtered.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const base = filtered.map(([k, v]) => `${k}=${v}`).join("&") + `&key=${key}`;
  return crypto.createHash("md5").update(base, "utf8").digest("hex").toLowerCase();
}

function utcDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

async function postForm(url: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _rawText: text, _status: res.status };
  }
}

// Money-safety classification for a transfer/query response (§5b)
function classifyPayout(data: any, transferId: string): PayoutResult {
  const raw = JSON.stringify(data ?? {}).slice(0, 800);
  const respCode = data?.respCode;
  const tradeResult = data?.tradeResult !== undefined ? String(data.tradeResult) : undefined;
  const errorMsg = data?.errorMsg;
  const blob = `${data?.tradeMsg || ""} ${data?.msg || ""} ${data?._rawText || ""}`.toLowerCase();

  // Explicit rejection: money did not leave
  if (respCode !== undefined && respCode !== "SUCCESS") {
    return { status: "failed", raw, message: data?.tradeMsg || respCode };
  }
  if (errorMsg && String(errorMsg).toLowerCase() !== "null" && String(errorMsg).trim() !== "") {
    return { status: "failed", raw, message: String(errorMsg) };
  }
  // Explicit delivered
  if (tradeResult === "1" || /\b(success|paid|finish|complete|done)\b/.test(blob)) {
    return { status: "paid", providerRef: data?.tradeNo ? String(data.tradeNo) : transferId, raw };
  }
  // tradeResult 0 (submitted) or 4 (frozen/processing) = in flight, NOT failure
  return { status: "processing", providerRef: data?.tradeNo ? String(data.tradeNo) : transferId, raw };
}

async function relayFetch(path: string, init: RequestInit): Promise<{ status: number; data: any }> {
  const res = await fetch(`${ENV.NEKPAY_RELAY_URL}${path}`, {
    ...init,
    headers: { "x-relay-secret": ENV.NEKPAY_RELAY_SECRET, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _rawText: text };
  }
  return { status: res.status, data };
}

export const nekpayProvider: PaymentProvider = {
  name: "nekpay",

  // ── Deposits (§4) ──────────────────────────────────────────────────────────
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const params: Record<string, string> = {
      version: "1.0",
      mch_id: ENV.NEKPAY_MCH_ID,
      notify_url: input.notifyUrl,
      mch_order_no: input.mchOrderNo,
      pay_type: ENV.NEKPAY_PAY_TYPE,
      trade_amount: input.amount.toFixed(2),
      order_date: utcDate(),
      goods_name: "Wallet top-up",
      sign_type: "MD5",
    };
    if (input.pageUrl) params.page_url = input.pageUrl;
    params.sign = sign(params, ENV.NEKPAY_KEY);

    const data = await postForm(`${ENV.NEKPAY_API_URL}/pay/web`, params);
    const ok = data?.respCode === "SUCCESS" && String(data?.tradeResult) === "1" && !!data?.payInfo;
    return {
      ok,
      payUrl: ok ? String(data.payInfo) : "",
      providerRef: data?.orderNo !== undefined ? String(data.orderNo) : "",
      instant: false,
      message: ok ? undefined : `${data?.respCode || ""} ${data?.tradeMsg || ""}`.trim(),
    };
  },

  async queryOrder(mchOrderNo: string): Promise<QueryOrderResult> {
    const params: Record<string, string> = { mch_id: ENV.NEKPAY_MCH_ID, mch_order_no: mchOrderNo, sign_type: "MD5" };
    params.sign = sign(params, ENV.NEKPAY_KEY);
    const data = await postForm(`${ENV.NEKPAY_API_URL}${ENV.NEKPAY_QUERY_PATH}`, params);
    const paid = String(data?.tradeResult) === "1" && data?.respCode === "SUCCESS";
    const amount = Number(data?.tradeAmount ?? data?.trade_amount ?? 0) || 0;
    return { paid, amount, raw: JSON.stringify(data ?? {}).slice(0, 800) };
  },

  verifyCallback(params: Record<string, string>): CallbackResult {
    const provided = params.sign || "";
    const expected = sign(params, ENV.NEKPAY_KEY);
    let valid = false;
    try {
      valid = provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    } catch {
      valid = false;
    }
    return {
      valid,
      mchOrderNo: params.mch_order_no || params.mchOrderNo || "",
      paid: String(params.tradeResult) === "1",
      amount: Number(params.trade_amount ?? params.tradeAmount ?? 0) || 0,
    };
  },

  // ── Withdrawals via relay (§5) ────────────────────────────────────────────
  async payout(input: PayoutInput): Promise<PayoutResult> {
    if (!ENV.NEKPAY_RELAY_URL || !ENV.NEKPAY_RELAY_SECRET) {
      return { status: "failed", raw: "", message: "Payout relay not configured" };
    }
    try {
      const { status, data } = await relayFetch("/transfer", {
        method: "POST",
        body: JSON.stringify({
          mch_transferId: input.transferId,
          transfer_amount: String(input.amount),
          bank_code: input.bankCode,
          receive_name: input.accountName,
          receive_account: input.accountNumber,
          remark: "Task Earner payout",
          back_url: input.backUrl,
        }),
      });
      if (status === 403) return { status: "failed", raw: "403", message: "check NEKPAY_RELAY_SECRET" };
      return classifyPayout(data, input.transferId);
    } catch (e: any) {
      // Never reached NEKpay (relay down / network) — mark processing with a
      // recoverable marker so the retry path can re-send (§5d).
      return { status: "processing", raw: `Unconfirmed: ${String(e?.message || e)}`.slice(0, 300) };
    }
  },

  async queryPayout(transferId: string): Promise<PayoutResult> {
    if (!ENV.NEKPAY_RELAY_URL) return { status: "processing", raw: "no relay" };
    try {
      const { status, data } = await relayFetch(`/query?transferId=${encodeURIComponent(transferId)}`, { method: "GET" });
      if (status === 403) return { status: "failed", raw: "403", message: "check NEKPAY_RELAY_SECRET" };
      return classifyPayout(data, transferId);
    } catch (e: any) {
      return { status: "processing", raw: `Unconfirmed: ${String(e?.message || e)}`.slice(0, 300) };
    }
  },

  async balance(): Promise<{ ok: boolean; balance: number }> {
    if (!ENV.NEKPAY_RELAY_URL) return { ok: false, balance: 0 };
    try {
      const { status, data } = await relayFetch("/balance", { method: "GET" });
      if (status !== 200) return { ok: false, balance: 0 };
      return { ok: true, balance: Number(data?.balance ?? data?.amount ?? 0) || 0 };
    } catch {
      return { ok: false, balance: 0 };
    }
  },
};
