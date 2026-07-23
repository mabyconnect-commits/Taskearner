import { InitPaymentInput, InitPaymentResult, PaymentProvider, PayoutInput, PayoutResult, VerifyResult } from "./types";

// Mock provider: settles instantly with no external calls. Lets the whole
// funding/payout flow run end-to-end before real NekPay keys are wired in.
export const mockProvider: PaymentProvider = {
  name: "mock",
  async initPayment(input: InitPaymentInput): Promise<InitPaymentResult> {
    return { authorizationUrl: "", reference: input.reference, instant: true };
  },
  async verifyPayment(): Promise<VerifyResult> {
    return { status: "success", amount: 0 };
  },
  async initPayout(input: PayoutInput): Promise<PayoutResult> {
    return { status: "success", reference: input.reference };
  },
  verifyWebhook(): boolean {
    return true;
  },
};
