import { CallbackResult, CreateOrderInput, CreateOrderResult, PaymentProvider, PayoutInput, PayoutResult, QueryOrderResult } from "./types.js";

// Mock provider: settles instantly, no external calls. Lets the whole
// deposit/withdrawal flow run before real NEKpay keys are configured.
export const mockProvider: PaymentProvider = {
  name: "mock",
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return { ok: true, payUrl: "", providerRef: `mock_${input.mchOrderNo}`, instant: true };
  },
  async queryOrder(): Promise<QueryOrderResult> {
    return { paid: true, amount: 0, raw: "mock" };
  },
  verifyCallback(params: Record<string, string>): CallbackResult {
    return { valid: true, mchOrderNo: params.mch_order_no || "", paid: true, amount: Number(params.trade_amount || 0) };
  },
  async payout(input: PayoutInput): Promise<PayoutResult> {
    return { status: "paid", providerRef: `mock_${input.transferId}`, raw: "mock" };
  },
  async queryPayout(transferId: string): Promise<PayoutResult> {
    return { status: "paid", providerRef: `mock_${transferId}`, raw: "mock" };
  },
  async balance(): Promise<{ ok: boolean; balance: number }> {
    return { ok: true, balance: 1_000_000 };
  },
};
