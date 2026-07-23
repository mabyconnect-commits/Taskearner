import crypto from "node:crypto";
import { ENV } from "../env";
import { InitPaymentInput, InitPaymentResult, PaymentProvider, PayoutInput, PayoutResult, VerifyResult } from "./types";

/**
 * NekPay adapter.
 *
 * ⚠️ IMPORTANT: The exact endpoints, request/response shapes and signature
 * scheme below follow the common Nigerian-gateway (Paystack-style) convention.
 * Confirm them against NekPay's official API docs and adjust the paths/fields
 * if they differ. Set these env vars in Vercel to go live:
 *   PAYMENT_PROVIDER=nekpay
 *   NEKPAY_SECRET_KEY=sk_live_xxx
 *   NEKPAY_PUBLIC_KEY=pk_live_xxx
 *   NEKPAY_BASE_URL=https://api.nekpay.com   (only if different)
 */
async function nekFetch(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`${ENV.NEKPAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ENV.NEKPAY_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `NekPay error (${res.status})`);
  return data;
}

export const nekpayProvider: PaymentProvider = {
  name: "nekpay",

  async initPayment(input: InitPaymentInput): Promise<InitPaymentResult> {
    // POST /transaction/initialize  { amount(kobo), email, reference, callback_url }
    const data = await nekFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        email: input.email,
        reference: input.reference,
        callback_url: input.callbackUrl,
      }),
    });
    return {
      authorizationUrl: data?.data?.authorization_url ?? "",
      reference: data?.data?.reference ?? input.reference,
      instant: false,
    };
  },

  async verifyPayment(reference: string): Promise<VerifyResult> {
    // GET /transaction/verify/:reference
    const data = await nekFetch(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
    const status = data?.data?.status;
    return {
      status: status === "success" ? "success" : status === "failed" ? "failed" : "pending",
      amount: (data?.data?.amount ?? 0) / 100,
    };
  },

  async initPayout(input: PayoutInput): Promise<PayoutResult> {
    // POST /transfer  { amount(kobo), account_number, account_name, bank, reference }
    const data = await nekFetch("/transfer", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        account_number: input.accountNumber,
        account_name: input.accountName,
        bank: input.bankName,
        reference: input.reference,
      }),
    });
    const status = data?.data?.status;
    return {
      status: status === "success" ? "success" : status === "failed" ? "failed" : "processing",
      reference: data?.data?.reference ?? input.reference,
    };
  },

  verifyWebhook(rawBody: string, signature: string | undefined): boolean {
    if (!signature || !ENV.NEKPAY_SECRET_KEY) return false;
    // Common scheme: HMAC-SHA512 of the raw body keyed with the secret key.
    const expected = crypto.createHmac("sha512", ENV.NEKPAY_SECRET_KEY).update(rawBody).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  },
};
