import { ensureSchema, sql, num } from "./_lib/db";
import { ApiRequest, ApiResponse, HttpError, ok, err } from "./_lib/http";
import { comparePassword, hashPassword, requireAuth, signToken } from "./_lib/auth";
import { PLANS, planOf, WITHDRAW_MIN, COOLDOWN_MS } from "./_lib/plans";
import { loadState, reference, serializeUser } from "./_lib/state";
import { getProvider } from "./_lib/payments";
import { ENV } from "./_lib/env";

function slugUsername(name: string): string {
  const base = (name.trim().split(" ")[0] || "earner").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${base || "earner"}${Math.floor(Math.random() * 9000 + 1000)}`;
}

async function txList(uid: string) {
  const rows = await sql`
    SELECT id, type, title, amount, wallet, status, created_at
    FROM transactions WHERE user_id = ${uid}
    ORDER BY created_at DESC LIMIT 60`;
  return rows.map((t: any) => ({
    id: t.id, type: t.type, title: t.title, amount: num(t.amount),
    wallet: t.wallet, status: t.status, ts: new Date(t.created_at).getTime(),
  }));
}

async function referralList(uid: string) {
  const rows = await sql`
    SELECT id, name, plan, status, commission, created_at
    FROM referrals WHERE referrer_id = ${uid}
    ORDER BY created_at DESC LIMIT 100`;
  return rows.map((r: any) => ({
    id: r.id, name: r.name, plan: r.plan, status: r.status,
    commission: num(r.commission), ts: new Date(r.created_at).getTime(),
  }));
}

// ── Route handlers ─────────────────────────────────────────────────────────

async function signup(req: ApiRequest): Promise<ApiResponse> {
  const { name, email, password, ref } = req.body || {};
  if (!name?.trim()) return err("Name is required");
  if (!email?.includes("@")) return err("A valid email is required");
  if (!password || password.length < 6) return err("Password must be at least 6 characters");

  const [existing] = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
  if (existing) return err("An account with this email already exists", 409);

  let referrer: any = null;
  if (ref) [referrer] = await sql`SELECT id, name FROM users WHERE username = ${String(ref).toLowerCase()}`;

  const hash = await hashPassword(password);
  let username = slugUsername(name);
  // ensure unique username
  for (let i = 0; i < 5; i++) {
    const [clash] = await sql`SELECT 1 FROM users WHERE username = ${username}`;
    if (!clash) break;
    username = slugUsername(name);
  }

  const [u] = await sql`
    INSERT INTO users (name, username, email, password_hash, referred_by)
    VALUES (${name.trim()}, ${username}, ${email.toLowerCase()}, ${hash}, ${referrer?.id ?? null})
    RETURNING *`;

  if (referrer) {
    await sql`
      INSERT INTO referrals (referrer_id, referred_id, name, status)
      VALUES (${referrer.id}, ${u.id}, ${name.trim()}, 'pending')`;
  }

  const token = signToken(u.id);
  return ok({ token, user: serializeUser(u) }, 201);
}

async function login(req: ApiRequest): Promise<ApiResponse> {
  const { email, password } = req.body || {};
  if (!email || !password) return err("Email and password are required");
  const [u] = await sql`SELECT * FROM users WHERE email = ${String(email).toLowerCase()}`;
  if (!u) return err("Invalid email or password", 401);
  const good = await comparePassword(password, u.password_hash);
  if (!good) return err("Invalid email or password", 401);
  const [bank] = await sql`SELECT * FROM banks WHERE user_id = ${u.id}`;
  return ok({ token: signToken(u.id), user: serializeUser(u, bank) });
}

async function me(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const [user, transactions, referrals] = await Promise.all([loadState(uid), txList(uid), referralList(uid)]);
  return ok({ user, transactions, referrals });
}

async function updateProfile(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const { name, phone, email } = req.body || {};
  await sql`
    UPDATE users SET
      name  = COALESCE(${name ?? null}, name),
      phone = COALESCE(${phone ?? null}, phone),
      email = COALESCE(${email ? String(email).toLowerCase() : null}, email)
    WHERE id = ${uid}`;
  return ok({ user: await loadState(uid) });
}

async function linkSocial(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  await sql`UPDATE users SET social_linked = true WHERE id = ${uid}`;
  return ok({ user: await loadState(uid) });
}

async function addBank(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const { bankName, accountNumber, accountName } = req.body || {};
  if (!bankName || !/^\d{10}$/.test(String(accountNumber || "")) || !accountName?.trim())
    return err("Provide a bank, a 10-digit account number and account name");
  await sql`
    INSERT INTO banks (user_id, bank_name, account_number, account_name)
    VALUES (${uid}, ${bankName}, ${accountNumber}, ${accountName.trim()})
    ON CONFLICT (user_id) DO UPDATE SET
      bank_name = EXCLUDED.bank_name,
      account_number = EXCLUDED.account_number,
      account_name = EXCLUDED.account_name,
      updated_at = now()`;
  return ok({ user: await loadState(uid) });
}

async function earn(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const { kind, refId } = req.body || {};
  const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
  if (!u) return err("User not found", 404);
  if (u.plan === "free") return err("Activate a plan to start earning", 403);
  const plan = planOf(u.plan);

  const now = Date.now();
  const cooldowns: Record<string, number> = u.cooldowns ?? {};
  const completed = u.completed ?? { tasks: [], posts: [] };

  let amount = 0;
  let title = "";
  const type = kind;

  if (kind === "voice") {
    if ((cooldowns.voice ?? 0) > now) return err("This activity is cooling down", 429);
    amount = plan.perVoice; title = "Voice Earn session completed";
    cooldowns.voice = now + COOLDOWN_MS;
  } else if (kind === "word") {
    if ((cooldowns.word ?? 0) > now) return err("This activity is cooling down", 429);
    const count = Math.max(1, Math.min(10, Math.floor(Number(req.body?.count) || 1)));
    amount = plan.perWord * count; title = "Word Game completed";
    cooldowns.word = now + COOLDOWN_MS;
  } else if (kind === "task") {
    if (!refId) return err("Missing task id");
    if (completed.tasks.includes(refId)) return err("Task already completed", 409);
    amount = plan.perTask; title = "Daily task completed";
    completed.tasks = [...completed.tasks, refId];
  } else if (kind === "post") {
    if (!refId) return err("Missing post id");
    if (completed.posts.includes(refId)) return err("Post already shared", 409);
    amount = plan.perPost; title = "Sponsored post shared";
    completed.posts = [...completed.posts, refId];
  } else {
    return err("Unknown activity");
  }

  await sql.begin(async (tx) => {
    await tx`
      UPDATE users SET engagement = engagement + ${amount},
        cooldowns = ${tx.json(cooldowns)}, completed = ${tx.json(completed)}
      WHERE id = ${uid}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${uid}, ${type}, ${title}, ${amount}, 'engagement')`;
  });

  return ok({ amount, user: await loadState(uid), transactions: await txList(uid) });
}

async function activatePlan(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const { planId } = req.body || {};
  const target = PLANS[planId as keyof typeof PLANS];
  if (!target || target.id === "free") return err("Invalid plan");

  const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
  if (!u) return err("User not found", 404);
  const current = planOf(u.plan);
  if (u.plan === target.id) return err("This plan is already active");
  if (u.plan !== "free" && target.price <= current.price) return err("You can only upgrade to a higher plan");

  const cost = target.price - (u.plan === "free" ? 0 : current.price);
  if (num(u.deposit) < cost) return err("Insufficient deposit balance. Fund your wallet first.");

  await sql.begin(async (tx) => {
    await tx`UPDATE users SET deposit = deposit - ${cost}, plan = ${target.id} WHERE id = ${uid}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${uid}, 'plan', ${"Activated " + target.name + " plan"}, ${-cost}, 'deposit')`;

    // Affiliate commission: pay the referrer the first time this user activates.
    if (u.referred_by) {
      const [ref] = await tx`
        SELECT * FROM referrals WHERE referred_id = ${uid} AND referrer_id = ${u.referred_by}`;
      if (ref && ref.status !== "activated") {
        const commission = target.commission;
        await tx`
          UPDATE referrals SET status = 'activated', plan = ${target.id}, commission = ${commission}
          WHERE id = ${ref.id}`;
        await tx`UPDATE users SET sales = sales + ${commission} WHERE id = ${u.referred_by}`;
        await tx`
          INSERT INTO transactions (user_id, type, title, amount, wallet)
          VALUES (${u.referred_by}, 'commission', 'Referral commission', ${commission}, 'sales')`;
      }
    }
  });

  return ok({ user: await loadState(uid), transactions: await txList(uid) });
}

async function fundInitiate(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const amount = Math.floor(Number(req.body?.amount) || 0);
  if (amount < 100) return err("Minimum funding is ₦100");
  const [u] = await sql`SELECT email FROM users WHERE id = ${uid}`;
  const provider = getProvider();
  const ref = reference("fund");
  const init = await provider.initPayment({
    reference: ref,
    amount,
    email: u.email,
    callbackUrl: `${ENV.APP_URL}/deposit?ref=${ref}`,
  });
  await sql`
    INSERT INTO payments (user_id, reference, provider, purpose, amount, status)
    VALUES (${uid}, ${ref}, ${provider.name}, 'fund', ${amount}, 'pending')`;
  return ok({ reference: ref, authorizationUrl: init.authorizationUrl, instant: init.instant });
}

async function creditFunding(uid: string, ref: string): Promise<void> {
  await sql.begin(async (tx) => {
    const [p] = await tx`SELECT * FROM payments WHERE reference = ${ref} AND user_id = ${uid} FOR UPDATE`;
    if (!p || p.status === "paid") return;
    await tx`UPDATE payments SET status = 'paid' WHERE id = ${p.id}`;
    await tx`UPDATE users SET deposit = deposit + ${num(p.amount)} WHERE id = ${uid}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${uid}, 'fund', 'Wallet funding (NekPay)', ${num(p.amount)}, 'deposit')`;
  });
}

async function fundVerify(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const ref = String(req.body?.reference || req.query.reference || "");
  if (!ref) return err("Missing reference");
  const [p] = await sql`SELECT * FROM payments WHERE reference = ${ref} AND user_id = ${uid}`;
  if (!p) return err("Payment not found", 404);

  const provider = getProvider();
  const result = await provider.verifyPayment(ref);
  if (result.status === "success") {
    await creditFunding(uid, ref);
    return ok({ status: "success", user: await loadState(uid), transactions: await txList(uid) });
  }
  return ok({ status: result.status, user: await loadState(uid) });
}

async function webhook(req: ApiRequest): Promise<ApiResponse> {
  const provider = getProvider();
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  const sig = (req.headers["x-nekpay-signature"] || req.headers["x-webhook-signature"]) as string | undefined;
  if (!provider.verifyWebhook(raw, sig)) return err("Invalid signature", 401);
  const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const ref = event?.data?.reference;
  if (ref && event?.event?.includes("success")) {
    const [p] = await sql`SELECT user_id FROM payments WHERE reference = ${ref}`;
    if (p) await creditFunding(p.user_id, ref);
  }
  return ok({ received: true });
}

async function withdraw(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const walletKind = req.body?.wallet === "sales" ? "sales" : "engagement";
  const amount = Math.floor(Number(req.body?.amount) || 0);

  const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
  const [bank] = await sql`SELECT * FROM banks WHERE user_id = ${uid}`;
  if (!bank) return err("Add a payout bank account first");
  if (amount < WITHDRAW_MIN) return err(`Minimum withdrawal is ₦${WITHDRAW_MIN.toLocaleString()}`);
  const balance = walletKind === "sales" ? num(u.sales) : num(u.engagement);
  if (amount > balance) return err("Insufficient balance in this wallet");

  const provider = getProvider();
  const ref = reference("payout");
  const payout = await provider.initPayout({
    reference: ref,
    amount,
    bankName: bank.bank_name,
    accountNumber: bank.account_number,
    accountName: bank.account_name,
  });

  await sql.begin(async (tx) => {
    if (walletKind === "sales") await tx`UPDATE users SET sales = sales - ${amount} WHERE id = ${uid}`;
    else await tx`UPDATE users SET engagement = engagement - ${amount} WHERE id = ${uid}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet, status)
      VALUES (${uid}, 'withdraw', ${"Withdrawal to " + bank.bank_name}, ${-amount}, ${walletKind}, ${payout.status})`;
    await tx`
      INSERT INTO payouts (user_id, reference, amount, wallet, bank_name, account_number, account_name, status)
      VALUES (${uid}, ${ref}, ${amount}, ${walletKind}, ${bank.bank_name}, ${bank.account_number}, ${bank.account_name}, ${payout.status})`;
  });

  return ok({ status: payout.status, user: await loadState(uid), transactions: await txList(uid) });
}

async function payBill(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const amount = Math.floor(Number(req.body?.amount) || 0);
  const title = String(req.body?.title || "Bill payment");
  if (amount < 50) return err("Enter an amount of at least ₦50");
  const [u] = await sql`SELECT engagement, deposit FROM users WHERE id = ${uid}`;
  if (amount > num(u.engagement) + num(u.deposit)) return err("Insufficient wallet balance");
  const fromEng = Math.min(amount, num(u.engagement));
  const fromDep = amount - fromEng;
  await sql.begin(async (tx) => {
    await tx`UPDATE users SET engagement = engagement - ${fromEng}, deposit = deposit - ${fromDep} WHERE id = ${uid}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${uid}, 'bill', ${title}, ${-amount}, 'engagement')`;
  });
  return ok({ user: await loadState(uid), transactions: await txList(uid) });
}

async function getTransactions(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  return ok({ transactions: await txList(uid) });
}

async function getReferrals(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  return ok({ referrals: await referralList(uid) });
}

// ── Dispatch ────────────────────────────────────────────────────────────────

type Handler = (req: ApiRequest) => Promise<ApiResponse>;

const routes: Record<string, Handler> = {
  "GET /health": async () => ok({ ok: true, provider: getProvider().name }),
  "POST /auth/signup": signup,
  "POST /auth/login": login,
  "GET /me": me,
  "PATCH /profile": updateProfile,
  "POST /profile/social": linkSocial,
  "POST /bank": addBank,
  "POST /earn": earn,
  "POST /plans/activate": activatePlan,
  "POST /fund/initiate": fundInitiate,
  "POST /fund/verify": fundVerify,
  "POST /payments/webhook": webhook,
  "POST /withdraw": withdraw,
  "POST /bills/pay": payBill,
  "GET /transactions": getTransactions,
  "GET /referrals": getReferrals,
};

export async function handleApi(req: ApiRequest): Promise<ApiResponse> {
  try {
    await ensureSchema();
    const key = `${req.method.toUpperCase()} ${req.path}`;
    const handler = routes[key];
    if (!handler) return err(`No route for ${key}`, 404);
    return await handler(req);
  } catch (e: any) {
    if (e instanceof HttpError) return err(e.message, e.status);
    console.error("[api] error:", e);
    return err("Something went wrong. Please try again.", 500);
  }
}
