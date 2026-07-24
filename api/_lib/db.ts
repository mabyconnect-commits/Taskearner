import postgres from "postgres";
import { ENV } from "./env";

// Reuse the connection across serverless invocations (Vercel keeps the module
// warm between requests on the same instance).
declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Promise<void> | undefined;
}

export const sql =
  global.__sql ||
  postgres(ENV.DATABASE_URL, {
    ssl: ENV.IS_PROD ? "require" : false,
    max: ENV.IS_PROD ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (!ENV.IS_PROD) global.__sql = sql;

// Idempotent schema creation. Runs once per warm instance.
export async function ensureSchema(): Promise<void> {
  if (global.__schemaReady) return global.__schemaReady;
  const run = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name          text NOT NULL,
        username      text UNIQUE NOT NULL,
        email         text UNIQUE NOT NULL,
        phone         text NOT NULL DEFAULT '',
        password_hash text NOT NULL,
        plan          text NOT NULL DEFAULT 'free',
        social_linked boolean NOT NULL DEFAULT false,
        engagement    numeric(14,2) NOT NULL DEFAULT 0,
        sales         numeric(14,2) NOT NULL DEFAULT 0,
        deposit       numeric(14,2) NOT NULL DEFAULT 0,
        completed     jsonb NOT NULL DEFAULT '{"tasks":[],"posts":[]}'::jsonb,
        cooldowns     jsonb NOT NULL DEFAULT '{}'::jsonb,
        referred_by   uuid REFERENCES users(id),
        created_at    timestamptz NOT NULL DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS banks (
        user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        bank_name      text NOT NULL,
        account_number text NOT NULL,
        account_name   text NOT NULL,
        updated_at     timestamptz NOT NULL DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       text NOT NULL,
        title      text NOT NULL,
        amount     numeric(14,2) NOT NULL,
        wallet     text NOT NULL,
        status     text NOT NULL DEFAULT 'completed',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at DESC);`;
    await sql`
      CREATE TABLE IF NOT EXISTS referrals (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_id   uuid REFERENCES users(id),
        name          text NOT NULL,
        plan          text NOT NULL DEFAULT 'free',
        status        text NOT NULL DEFAULT 'pending',
        commission    numeric(14,2) NOT NULL DEFAULT 0,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_ref_referrer ON referrals(referrer_id, created_at DESC);`;
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reference  text UNIQUE NOT NULL,
        provider   text NOT NULL,
        purpose    text NOT NULL DEFAULT 'fund',
        amount     numeric(14,2) NOT NULL,
        status     text NOT NULL DEFAULT 'pending',
        meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS payouts (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reference      text UNIQUE NOT NULL,
        amount         numeric(14,2) NOT NULL,
        wallet         text NOT NULL,
        bank_name      text NOT NULL,
        account_number text NOT NULL,
        account_name   text NOT NULL,
        status         text NOT NULL DEFAULT 'processing',
        created_at     timestamptz NOT NULL DEFAULT now()
      );
    `;
  })();
  // Cache the in-flight promise so concurrent requests share it, but if it
  // rejects (e.g. DB briefly unreachable on a cold start), clear the cache so
  // the next request retries instead of failing forever.
  global.__schemaReady = run;
  run.catch(() => {
    global.__schemaReady = undefined;
  });
  return run;
}

export function num(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? 0)) || 0;
}
