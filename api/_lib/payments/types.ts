export interface InitPaymentInput {
  reference: string;
  amount: number; // in Naira
  email: string;
  callbackUrl: string;
}

export interface InitPaymentResult {
  // URL to redirect the user to for checkout (empty for mock/instant providers)
  authorizationUrl: string;
  reference: string;
  // true when the provider settles instantly (mock) and no redirect is needed
  instant: boolean;
}

export interface VerifyResult {
  status: "success" | "pending" | "failed";
  amount: number;
}

export interface PayoutInput {
  reference: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface PayoutResult {
  status: "processing" | "success" | "failed";
  reference: string;
}

export interface PaymentProvider {
  name: string;
  initPayment(input: InitPaymentInput): Promise<InitPaymentResult>;
  verifyPayment(reference: string): Promise<VerifyResult>;
  initPayout(input: PayoutInput): Promise<PayoutResult>;
  verifyWebhook(rawBody: string, signature: string | undefined): boolean;
}
