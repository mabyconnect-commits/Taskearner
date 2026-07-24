// Payment provider abstraction shaped around NEKpay (pay-in direct + pay-out
// via relay), with a mock implementation for local/dev.

export interface CreateOrderInput {
  mchOrderNo: string;
  amount: number; // NGN
  email: string;
  notifyUrl: string;
  pageUrl?: string;
}

export interface CreateOrderResult {
  ok: boolean;
  payUrl: string; // URL to send the user to (empty for instant/mock)
  providerRef: string; // NEKpay orderNo (stringified)
  instant: boolean; // true for mock — settles without redirect
  message?: string; // internal log only; never surface raw provider codes
}

export interface QueryOrderResult {
  paid: boolean;
  amount: number;
  raw: string;
}

export interface CallbackResult {
  valid: boolean; // signature verified
  mchOrderNo: string;
  paid: boolean;
  amount: number;
}

export interface PayoutInput {
  transferId: string; // fresh idempotency id per attempt
  amount: number; // NGN
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  backUrl: string;
}

export type PayoutStatus = "sent" | "paid" | "failed" | "processing";

export interface PayoutResult {
  status: PayoutStatus;
  providerRef?: string; // NEKpay tradeNo
  raw: string;
  message?: string;
}

export interface PaymentProvider {
  name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  queryOrder(mchOrderNo: string): Promise<QueryOrderResult>;
  verifyCallback(params: Record<string, string>): CallbackResult;
  payout(input: PayoutInput): Promise<PayoutResult>;
  queryPayout(transferId: string): Promise<PayoutResult>;
  balance(): Promise<{ ok: boolean; balance: number }>;
}
