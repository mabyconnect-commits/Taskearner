// Centralised environment config for the backend.
export const ENV = {
  DATABASE_URL:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "postgres://taskearner:taskearner@127.0.0.1:5432/taskearner",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-me-in-production",
  // Comma-separated emails that get admin access.
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
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

  // Flutterwave — used only for bank list + account-name resolution.
  FLW_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY || "",
  FLW_BASE_URL: process.env.FLW_BASE_URL || "https://api.flutterwave.com",

  // Telegram support bot. TELEGRAM_BOT_TOKEN enables the /telegram/webhook
  // endpoint; TELEGRAM_SUPPORT_GROUP_ID is the staff/ops group tickets escalate
  // to; TELEGRAM_WEBHOOK_SECRET (optional) is checked against Telegram's
  // X-Telegram-Bot-Api-Secret-Token header so only Telegram can call the hook.
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_SUPPORT_GROUP_ID: process.env.TELEGRAM_SUPPORT_GROUP_ID || "",
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  // Telegram usernames (without @) allowed to resolve tickets + use admin
  // commands in the bot. Comma-separated; defaults to the app owners.
  TELEGRAM_ADMINS: (process.env.TELEGRAM_ADMINS || "Charmerfz3,Jadennkurtz")
    .split(",").map((s) => s.trim().replace(/^@/, "").toLowerCase()).filter(Boolean),
  // Public-facing links surfaced in the bot menu.
  // Canonical domain: the bare apex (taskearner.site) 308-redirects to www, and
  // Telegram / payment callbacks don't follow redirects — so default to www.
  APP_PUBLIC_URL: process.env.APP_PUBLIC_URL || "https://www.taskearner.site",
  TELEGRAM_CHANNEL_URL: process.env.TELEGRAM_CHANNEL_URL || "https://t.me/taskearning101",
  TELEGRAM_GROUP_URL: process.env.TELEGRAM_GROUP_URL || "https://t.me/+ABIZY4MltSdmNzI5",
};
