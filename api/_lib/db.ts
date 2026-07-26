import postgres from "postgres";
import { ENV } from "./env.js";

// Reuse the connection across serverless invocations (Vercel keeps the module
// warm between requests on the same instance).
declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Promise<void> | undefined;
}

function createSql(): ReturnType<typeof postgres> {
  return postgres(ENV.DATABASE_URL, {
    ssl: ENV.IS_PROD ? "require" : false,
    max: ENV.IS_PROD ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Lazily construct the connection on first use. If DATABASE_URL is malformed,
// postgres() throws — doing that at module load would crash the whole
// serverless function (FUNCTION_INVOCATION_FAILED) before any error handling
// runs. Deferring it lets the error be caught and reported as clean JSON.
function realSql(): ReturnType<typeof postgres> {
  if (!global.__sql) global.__sql = createSql();
  return global.__sql;
}

export const sql: ReturnType<typeof postgres> = new Proxy(function () {} as any, {
  apply(_target, _thisArg, args) {
    return (realSql() as any)(...args);
  },
  get(_target, prop) {
    const s = realSql() as any;
    const v = s[prop];
    return typeof v === "function" ? v.bind(s) : v;
  },
});

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
        daily         jsonb NOT NULL DEFAULT '{}'::jsonb,
        referred_by   uuid REFERENCES users(id),
        created_at    timestamptz NOT NULL DEFAULT now()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS banks (
        user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        bank_name      text NOT NULL,
        bank_code      text NOT NULL DEFAULT '',
        account_number text NOT NULL,
        account_name   text NOT NULL,
        updated_at     timestamptz NOT NULL DEFAULT now()
      );
    `;
    // Paystack/Flutterwave bank code, used to derive the NEKpay payout code.
    await sql`ALTER TABLE banks ADD COLUMN IF NOT EXISTS bank_code text NOT NULL DEFAULT ''`;
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
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reference       text UNIQUE NOT NULL,
        amount          numeric(14,2) NOT NULL,
        wallet          text NOT NULL,
        bank_name       text NOT NULL,
        account_number  text NOT NULL,
        account_name    text NOT NULL,
        status          text NOT NULL DEFAULT 'PENDING',
        provider_ref    text NOT NULL DEFAULT '',
        provider_status text NOT NULL DEFAULT '',
        tx_id           uuid,
        created_at      timestamptz NOT NULL DEFAULT now()
      );
    `;
    // Columns added after initial release (no-op on fresh DBs)
    await sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS provider_ref text NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS provider_status text NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS tx_id uuid`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily jsonb NOT NULL DEFAULT '{}'::jsonb`;
    // Referral wallet: available (withdrawable) balance of confirmed ₦250 bonuses.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral numeric(14,2) NOT NULL DEFAULT 0`;
    // Per-referral ₦250 signup bonus + its state ('pending' → 'available').
    await sql`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS bonus numeric(14,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS bonus_status text NOT NULL DEFAULT 'pending'`;

    // Admin-managed daily tasks
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id         text PRIMARY KEY,
        title      text NOT NULL,
        detail     text NOT NULL DEFAULT '',
        category   text NOT NULL DEFAULT 'social',
        link       text NOT NULL DEFAULT '',
        active     boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `;

    // Sponsored posts (official + user-submitted/advertiser-funded)
    await sql`
      CREATE TABLE IF NOT EXISTS sponsored (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        headline   text NOT NULL,
        copy       text NOT NULL,
        platform   text NOT NULL DEFAULT 'Facebook',
        budget     numeric(14,2) NOT NULL DEFAULT 0,
        spent      numeric(14,2) NOT NULL DEFAULT 0,
        status     text NOT NULL DEFAULT 'active',
        image      text NOT NULL DEFAULT '',
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `;
    // Shareable image (a compressed data: URL) earners can download for a post.
    await sql`ALTER TABLE sponsored ADD COLUMN IF NOT EXISTS image text NOT NULL DEFAULT ''`;

    // Telegram support bot: per-chat conversation state (serverless is stateless,
    // so the "what is this chat waiting to send me" flag lives here).
    await sql`
      CREATE TABLE IF NOT EXISTS bot_state (
        chat_id    text PRIMARY KEY,
        state      text NOT NULL DEFAULT 'idle',
        data       jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `;
    // Escalated support tickets. group_msg_id links a ticket to the message the
    // bot posted in the ops group, so a staff reply resolves the right ticket.
    await sql`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id           serial PRIMARY KEY,
        kind         text NOT NULL,
        chat_id      text NOT NULL,
        tg_username  text NOT NULL DEFAULT '',
        email        text NOT NULL DEFAULT '',
        reference    text NOT NULL DEFAULT '',
        details      text NOT NULL DEFAULT '',
        status       text NOT NULL DEFAULT 'open',
        group_msg_id bigint,
        created_at   timestamptz NOT NULL DEFAULT now()
      );
    `;
    await sql`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT ''`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_groupmsg ON support_tickets(group_msg_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ticket_chat_kind ON support_tickets(chat_id, kind, status);`;

    // Seed default tasks once (so the app works before an admin adds any)
    const [tc] = await sql`SELECT count(*)::int AS n FROM tasks`;
    if (tc.n === 0) {
      const defaults = [
        ["t1", "Follow Task Earner Africa on Instagram", "Tap follow and confirm your handle.", "social", ""],
        ["t2", "Watch a 30s promo video", "Watch the full clip to unlock the reward.", "watch", ""],
        ["t3", "Rate our app 5 stars", "Leave an honest review on the store.", "review", ""],
        ["t4", "Take a 2-minute survey", "Tell us how you like to earn online.", "survey", ""],
        ["t5", "Join our Telegram channel", "Stay updated with new earning drops.", "social", "https://t.me/taskearning101"],
        ["t6", "Share the daily quote", "Post today's motivation to your story.", "social", ""],
        ["t7", "Retweet the pinned post", "Amplify Task Earner Africa to your followers.", "social", ""],
        ["t8", "Watch: How payouts work", "Learn how withdrawals are processed.", "watch", ""],
      ];
      for (const [id, title, detail, category, link] of defaults) {
        await sql`INSERT INTO tasks (id, title, detail, category, link) VALUES (${id}, ${title}, ${detail}, ${category}, ${link}) ON CONFLICT DO NOTHING`;
      }
    }
    // Backfill the Telegram task link on existing databases that seeded it blank.
    await sql`UPDATE tasks SET link = 'https://t.me/taskearning101' WHERE id = 't5' AND (link = '' OR link IS NULL)`;
    const [sc] = await sql`SELECT count(*)::int AS n FROM sponsored`;
    if (sc.n === 0) {
      const posts = [
        ["TASK EARNER IS PAYING", "I just got paid on Task Earner Africa for reading sentences aloud. Join with my link!", "WhatsApp"],
        ["Your voice is currency", "Turn your talk and daily tasks into alerts. Task Earner Africa pays per session — no stress.", "Facebook"],
        ["Side hustle unlocked", "Made ₦2,000 today on @taskearnerafrica between classes. This is real.", "X"],
        ["Pay once, earn forever", "Lifetime plans on Task Earner Africa. Activate once and earn every single day.", "Instagram"],
        ["Talk = money", "POV: your voice is now a paycheck. Task Earner Africa is the wave. 🌍", "TikTok"],
      ];
      for (const [headline, copy, platform] of posts) {
        await sql`INSERT INTO sponsored (headline, copy, platform, budget, status) VALUES (${headline}, ${copy}, ${platform}, 0, 'active')`;
      }
    }
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
