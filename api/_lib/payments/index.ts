import { ENV } from "../env.js";
import { mockProvider } from "./mock.js";
import { nekpayProvider } from "./nekpay.js";
import { PaymentProvider } from "./types.js";

export function getProvider(): PaymentProvider {
  switch (ENV.PAYMENT_PROVIDER) {
    case "nekpay":
      return nekpayProvider;
    default:
      return mockProvider;
  }
}

export * from "./types.js";
