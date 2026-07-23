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
  NEKPAY_SECRET_KEY: process.env.NEKPAY_SECRET_KEY || "",
  NEKPAY_PUBLIC_KEY: process.env.NEKPAY_PUBLIC_KEY || "",
  NEKPAY_BASE_URL: process.env.NEKPAY_BASE_URL || "https://api.nekpay.com",
  APP_URL: process.env.APP_URL || "http://localhost:5173",
};
