import { ENV } from "../env";
import { mockProvider } from "./mock";
import { nekpayProvider } from "./nekpay";
import { PaymentProvider } from "./types";

export function getProvider(): PaymentProvider {
  switch (ENV.PAYMENT_PROVIDER) {
    case "nekpay":
      return nekpayProvider;
    default:
      return mockProvider;
  }
}

export * from "./types";
