// Centralised environment config for the backend.
export const ENV = {
  DATABASE_URL:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "postgres://taskearner:taskearner@127.0.0.1:5432/taskearner",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-me-in-production",
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_PROD: (process.env.VERCEL_ENV || process.env.NODE_ENV) === "production",

  // Payments
  PAYMENT_PROVIDER: (process.env.PAYMENT_PROVIDER || "mock").toLowerCase(), // "mock" | "nekpay"

  // NEKpay — deposits (pay-in), app talks to NEKpay directly
  NEKPAY_MCH_ID: process.env.NEKPAY_MCH_ID || "",
  NEKPAY_KEY: process.env.NEKPAY_KEY || "", // pay-in secret key (代收密钥)
  NEKPAY_PAY_TYPE: process.env.NEKPAY_PAY_TYPE || "",
  NEKPAY_API_URL: process.env.NEKPAY_API_URL || "https://api.nekpayment.com",
  NEKPAY_CALLBACK_IPS: process.env.NEKPAY_CALLBACK_IPS || "", // empty = signature-only
  NEKPAY_QUERY_PATH: process.env.NEKPAY_QUERY_PATH || "/query/order",

  // NEKpay — withdrawals (pay-out) via the fixed-IP relay
  NEKPAY_RELAY_URL: process.env.NEKPAY_RELAY_URL || "", // e.g. http://5.223.51.249:PORT
  NEKPAY_RELAY_SECRET: process.env.NEKPAY_RELAY_SECRET || "",
  NAIRA_AUTO_MAX_NGN: Number(process.env.NAIRA_AUTO_MAX_NGN || 65000),
  PAYOUT_AUTOSETTLE: process.env.NEKPAY_PAYOUT_AUTOSETTLE === "1",

  APP_URL: process.env.APP_URL || "http://localhost:5173",
};
