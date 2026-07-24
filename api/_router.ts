import crypto from "node:crypto";
import { ensureSchema, sql, num } from "./_lib/db";
import { ApiRequest, ApiResponse, HttpError, ok, err, textResp } from "./_lib/http";
import { comparePassword, hashPassword, requireAuth, signToken } from "./_lib/auth";
import { PLANS, planOf, SALES_WITHDRAW_MIN, COOLDOWN_MS, WORD_ROUNDS, dailyMax, utcDay, depositTax, depositTotal, withdrawFee, withdrawNet } from "./_lib/plans";
import { loadState, serializeUser, isAdminEmail } from "./_lib/state";
import { getProvider } from "./_lib/payments";
import { resolveBank, isInstantPayable } from "./_lib/payments/banks";
import { ENV } from "./_lib/env";

function formatNgn(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function genOrderNo(): string {
  return ("TE" + Date.now().toString() + crypto.randomBytes(3).toString("hex")).toUpperCase();
}
function genTransferId(uid: string): string {
  return `gp_${uid.slice(0, 8)}_${Date.now().toString(36)}`;
}

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

  // Daily usage: reset when the UTC day changes.
  const today = utcDay();
  const rawDaily = u.daily ?? {};
  const daily: { date: string; earned: number; voice: number; word: number; task: number; post: number } =
    rawDaily.date === today
      ? { date: today, earned: num(rawDaily.earned), voice: rawDaily.voice ?? 0, word: rawDaily.word ?? 0, task: rawDaily.task ?? 0, post: rawDaily.post ?? 0 }
      : { date: today, earned: 0, voice: 0, word: 0, task: 0, post: 0 };

  const capFor = (k: "voice" | "word" | "task" | "post") => plan.daily[k];
  const usedFor = (k: "voice" | "word" | "task" | "post") => daily[k];

  let amount = 0;
  let title = "";
  const type = kind;
  const kindKey = kind as "voice" | "word" | "task" | "post";

  if (kind === "voice") {
    if ((cooldowns.voice ?? 0) > now) return err("This activity is cooling down", 429);
    if (usedFor("voice") >= capFor("voice")) return err("You've completed today's Voice Earn. Come back tomorrow!", 429);
    amount = plan.perVoice; title = "Voice Earn session completed";
    cooldowns.voice = now + COOLDOWN_MS;
  } else if (kind === "word") {
    if ((cooldowns.word ?? 0) > now) return err("This activity is cooling down", 429);
    if (usedFor("word") >= capFor("word")) return err("You've hit today's Word Game limit. Come back tomorrow!", 429);
    const count = Math.max(1, Math.min(WORD_ROUNDS, Math.floor(Number(req.body?.count) || 1)));
    amount = plan.perWord * count; title = "Word Game completed";
    cooldowns.word = now + COOLDOWN_MS;
  } else if (kind === "task") {
    if (!refId) return err("Missing task id");
    if (completed.tasks.includes(refId)) return err("Task already completed", 409);
    if (usedFor("task") >= capFor("task")) return err("You've reached today's task limit for your plan.", 429);
    const [t] = await sql`SELECT id FROM tasks WHERE id = ${refId} AND active = true`;
    if (!t) return err("This task is no longer available", 404);
    amount = plan.perTask; title = "Daily task completed";
    completed.tasks = [...completed.tasks, refId];
  } else if (kind === "post") {
    if (!refId) return err("Missing post id");
    if (completed.posts.includes(refId)) return err("Post already shared", 409);
    if (usedFor("post") >= capFor("post")) return err("You've reached today's sponsored-post limit for your plan.", 429);
    const [sp] = await sql`SELECT * FROM sponsored WHERE id = ${refId} AND status = 'active'`;
    if (!sp) return err("This post is no longer available", 404);
    if (num(sp.budget) > 0 && num(sp.spent) + plan.perPost > num(sp.budget)) return err("This campaign has ended", 409);
    amount = plan.perPost; title = "Sponsored post shared";
    completed.posts = [...completed.posts, refId];
  } else {
    return err("Unknown activity");
  }

  // Enforce the plan's daily earning ceiling — never pay beyond expected funds.
  const ceiling = dailyMax(plan);
  const remaining = Math.max(0, ceiling - daily.earned);
  if (remaining <= 0) return err("You've reached today's earning limit for your plan.", 429);
  amount = Math.min(amount, remaining);

  daily.earned += amount;
  daily[kindKey] += 1;

  await sql.begin(async (tx) => {
    await tx`
      UPDATE users SET engagement = engagement + ${amount},
        cooldowns = ${tx.json(cooldowns)}, completed = ${tx.json(completed)}, daily = ${tx.json(daily)}
      WHERE id = ${uid}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${uid}, ${type}, ${title}, ${amount}, 'engagement')`;
    if (kind === "post" && refId) {
      // consume the advertiser's budget; end the campaign when exhausted
      await tx`
        UPDATE sponsored
        SET spent = spent + ${amount},
            status = CASE WHEN budget > 0 AND spent + ${amount} >= budget THEN 'ended' ELSE status END
        WHERE id = ${refId}`;
    }
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

// ── Deposits (pay-in) ────────────────────────────────────────────────────────
async function fundInitiate(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  // `amount` is what the user wants credited to their wallet (base). We charge
  // that plus an 8% tax on top; only the base lands in the wallet.
  const base = Math.floor(Number(req.body?.amount) || 0);
  if (base < 100) return err("Minimum funding is ₦100");
  const tax = depositTax(base);
  const total = depositTotal(base);
  const provider = getProvider();

  // Reuse a recent PENDING order for the same amount (refresh-safe)
  const [reuse] = await sql`
    SELECT reference, meta FROM payments
    WHERE user_id = ${uid} AND purpose = 'fund' AND status = 'pending' AND amount = ${base}
      AND created_at > now() - interval '25 minutes'
    ORDER BY created_at DESC LIMIT 1`;
  if (reuse && reuse.meta?.payUrl) {
    return ok({ reference: reuse.reference, authorizationUrl: reuse.meta.payUrl, instant: false, base, tax, total });
  }

  const [u] = await sql`SELECT email FROM users WHERE id = ${uid}`;
  const mchOrderNo = genOrderNo();
  const created = await provider.createOrder({
    mchOrderNo,
    amount: total, // charge base + 8% tax
    email: u.email,
    notifyUrl: `${ENV.APP_URL}/api/deposits/nekpay/callback`,
    pageUrl: `${ENV.APP_URL}/deposit?ref=${mchOrderNo}`,
  });
  if (!created.ok && !created.instant) {
    console.error("[nekpay] create order failed:", created.message);
    return err("Could not start payment. Please try again.");
  }
  // Store the credited amount (base) so the callback credits the wallet correctly.
  await sql`
    INSERT INTO payments (user_id, reference, provider, purpose, amount, status, meta)
    VALUES (${uid}, ${mchOrderNo}, ${provider.name}, 'fund', ${base}, 'pending',
            ${sql.json({ orderNo: created.providerRef, payUrl: created.payUrl, tax, total })})`;

  if (created.instant) {
    await creditDeposit(mchOrderNo);
    return ok({ reference: mchOrderNo, authorizationUrl: "", instant: true, base, tax, total });
  }
  return ok({ reference: mchOrderNo, authorizationUrl: created.payUrl, instant: false, base, tax, total });
}

// Idempotent credit: only the winner of the atomic PENDING claim credits once.
async function creditDeposit(mchOrderNo: string): Promise<void> {
  await sql.begin(async (tx) => {
    const [p] = await tx`SELECT * FROM payments WHERE reference = ${mchOrderNo} FOR UPDATE`;
    if (!p || p.status === "paid") return;
    await tx`UPDATE payments SET status = 'paid' WHERE id = ${p.id}`;
    await tx`UPDATE users SET deposit = deposit + ${num(p.amount)} WHERE id = ${p.user_id}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${p.user_id}, 'fund', 'Wallet funding (NEKpay)', ${num(p.amount)}, 'deposit')`;
  });
}

async function fundVerify(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const ref = String(req.body?.reference || req.query.reference || "");
  if (!ref) return err("Missing reference");
  const [p] = await sql`SELECT * FROM payments WHERE reference = ${ref} AND user_id = ${uid}`;
  if (!p) return err("Payment not found", 404);
  if (p.status === "paid") {
    return ok({ status: "success", user: await loadState(uid), transactions: await txList(uid) });
  }
  const provider = getProvider();
  const q = await provider.queryOrder(ref);
  if (q.paid) {
    await creditDeposit(ref);
    return ok({ status: "success", user: await loadState(uid), transactions: await txList(uid) });
  }
  return ok({ status: "pending", user: await loadState(uid) });
}

// Signed callback from NEKpay (form-urlencoded). Must reply literal "success".
async function nekpayCallback(req: ApiRequest): Promise<ApiResponse> {
  const provider = getProvider();
  const params: Record<string, string> = req.body && typeof req.body === "object" ? req.body : {};

  if (ENV.NEKPAY_CALLBACK_IPS) {
    const xff = String(req.headers["x-forwarded-for"] || "");
    const allowed = ENV.NEKPAY_CALLBACK_IPS.split(",").map((s) => s.trim()).filter(Boolean);
    if (!allowed.some((ip) => xff.includes(ip))) return textResp("retry", 200);
  }

  const r = provider.verifyCallback(params);
  if (!r.valid) return err("bad sign", 400);
  try {
    if (r.paid && r.mchOrderNo) await creditDeposit(r.mchOrderNo);
    else if (r.mchOrderNo) await sql`UPDATE payments SET status = 'failed' WHERE reference = ${r.mchOrderNo} AND status = 'pending'`;
    return textResp("success", 200);
  } catch (e) {
    console.error("[nekpay] callback credit error:", e);
    return textResp("retry", 500); // NEKpay retries
  }
}

// ── Withdrawals (pay-out via relay) ──────────────────────────────────────────
async function withdraw(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const walletKind = req.body?.wallet === "sales" ? "sales" : "engagement";
  const amount = Math.floor(Number(req.body?.amount) || 0);

  const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
  const [bank] = await sql`SELECT * FROM banks WHERE user_id = ${uid}`;
  if (!bank) return err("Add a payout bank account first");
  const plan = planOf(u.plan);
  // Engagement minimum depends on the user's plan; sales is flat for everyone.
  const minWithdraw = walletKind === "sales" ? SALES_WITHDRAW_MIN : plan.minWithdraw;
  if (amount < minWithdraw) return err(`Minimum withdrawal is ₦${minWithdraw.toLocaleString()}`);
  const balance = walletKind === "sales" ? num(u.sales) : num(u.engagement);
  if (amount > balance) return err("Insufficient balance in this wallet");

  // 3.5% tax + ₦50 VAT come off the withdrawal; the user receives the net. The
  // wallet is debited the full (gross) amount and refunded gross on failure.
  const fee = withdrawFee(amount);
  const net = withdrawNet(amount);

  const provider = getProvider();
  const transferId = genTransferId(uid);
  const bankEntry = resolveBank(bank.bank_name);

  // Receipt shown to the user after the request is submitted.
  const receiptBase = {
    reference: transferId,
    amount,
    fee,
    net,
    wallet: walletKind,
    bankName: bank.bank_name,
    accountNumber: bank.account_number,
    accountName: bank.account_name,
    ts: Date.now(),
  };
  const receipt = (status: string) => ({ ...receiptBase, status });

  // Reserve funds up front (debit + PENDING payout + pending ledger row), atomic
  const reserved = await sql.begin(async (tx) => {
    if (walletKind === "sales") await tx`UPDATE users SET sales = sales - ${amount} WHERE id = ${uid}`;
    else await tx`UPDATE users SET engagement = engagement - ${amount} WHERE id = ${uid}`;
    const [txn] = await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet, status)
      VALUES (${uid}, 'withdraw', ${`Withdrawal to ${bank.bank_name} · ${formatNgn(net)} net (${formatNgn(fee)} fee)`}, ${-amount}, ${walletKind}, 'pending')
      RETURNING id`;
    const [payout] = await tx`
      INSERT INTO payouts (user_id, reference, amount, wallet, bank_name, account_number, account_name, status, tx_id)
      VALUES (${uid}, ${transferId}, ${amount}, ${walletKind}, ${bank.bank_name}, ${bank.account_number}, ${bank.account_name}, 'PENDING', ${txn.id})
      RETURNING id`;
    return { payoutId: payout.id as string, txId: txn.id as string };
  });

  const relayReady = provider.name === "mock" || (!!ENV.NEKPAY_RELAY_URL && !!ENV.NEKPAY_RELAY_SECRET);
  const autoPayable = isInstantPayable(bank.bank_name) && amount <= ENV.NAIRA_AUTO_MAX_NGN && relayReady;

  if (!autoPayable) {
    // Manual queue (unsupported bank, over ceiling, or relay not configured). Funds reserved.
    return ok({ status: "pending", receipt: receipt("pending"), user: await loadState(uid), transactions: await txList(uid) });
  }

  // Atomic claim PENDING -> SENT (blocks double dispatch)
  const claim = await sql`UPDATE payouts SET status = 'SENT' WHERE id = ${reserved.payoutId} AND status = 'PENDING' RETURNING id`;
  if (claim.length === 0) return ok({ status: "pending", receipt: receipt("pending"), user: await loadState(uid), transactions: await txList(uid) });

  const res = await provider.payout({
    transferId,
    amount: net, // the bank receives the net amount after tax + VAT
    bankName: bank.bank_name,
    bankCode: bankEntry?.code || "",
    accountNumber: bank.account_number,
    accountName: bank.account_name,
    backUrl: `${ENV.APP_URL}/api/withdrawals/naira/callback`,
  });

  if (res.status === "failed") {
    // Explicit rejection → refund; nothing left the account.
    await sql.begin(async (tx) => {
      if (walletKind === "sales") await tx`UPDATE users SET sales = sales + ${amount} WHERE id = ${uid}`;
      else await tx`UPDATE users SET engagement = engagement + ${amount} WHERE id = ${uid}`;
      await tx`UPDATE payouts SET status = 'REJECTED', provider_status = ${res.raw} WHERE id = ${reserved.payoutId}`;
      await tx`DELETE FROM transactions WHERE id = ${reserved.txId}`;
    });
    return err(res.message ? "Withdrawal declined. No funds were deducted." : "Withdrawal declined. No funds were deducted.");
  }

  const paid = res.status === "paid";
  await sql.begin(async (tx) => {
    await tx`UPDATE payouts SET status = ${paid ? "PAID" : "SENT"}, provider_ref = ${res.providerRef || ""}, provider_status = ${res.raw} WHERE id = ${reserved.payoutId}`;
    await tx`UPDATE transactions SET status = ${paid ? "completed" : "pending"} WHERE id = ${reserved.txId}`;
  });
  return ok({ status: paid ? "success" : "processing", receipt: receipt(paid ? "success" : "processing"), user: await loadState(uid), transactions: await txList(uid) });
}

// Settle a SENT payout by trusting only the authenticated relay query (§5c).
async function settlePayout(transferId: string): Promise<void> {
  const [p] = await sql`SELECT * FROM payouts WHERE reference = ${transferId}`;
  if (!p || p.status === "PAID" || p.status === "REJECTED") return;
  const res = await getProvider().queryPayout(transferId);
  if (res.status === "paid") {
    await sql`UPDATE payouts SET status = 'PAID', provider_ref = ${res.providerRef || ""}, provider_status = ${res.raw} WHERE id = ${p.id}`;
    if (p.tx_id) await sql`UPDATE transactions SET status = 'completed' WHERE id = ${p.tx_id}`;
  } else if (res.status === "failed") {
    await sql.begin(async (tx) => {
      if (p.wallet === "sales") await tx`UPDATE users SET sales = sales + ${num(p.amount)} WHERE id = ${p.user_id}`;
      else await tx`UPDATE users SET engagement = engagement + ${num(p.amount)} WHERE id = ${p.user_id}`;
      await tx`UPDATE payouts SET status = 'REJECTED', provider_status = ${res.raw} WHERE id = ${p.id}`;
      if (p.tx_id) await tx`DELETE FROM transactions WHERE id = ${p.tx_id}`;
    });
  }
  // processing → leave SENT, re-query later
}

// back_url from the relay: don't trust the body — just re-query the payout.
async function withdrawalCallback(req: ApiRequest): Promise<ApiResponse> {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const ref = String(body.mch_transferId || body.transferId || req.query.transferId || "");
  if (ref) {
    try {
      await settlePayout(ref);
    } catch (e) {
      console.error("[nekpay] payout settle error:", e);
    }
  }
  return textResp("success", 200);
}

// Authenticated: re-check any SENT payouts for this user (settle on open).
async function payoutsReconcile(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const sent = await sql`SELECT reference FROM payouts WHERE user_id = ${uid} AND status = 'SENT'`;
  for (const row of sent) {
    try {
      await settlePayout(row.reference);
    } catch { /* keep going */ }
  }
  return ok({ user: await loadState(uid), transactions: await txList(uid) });
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

async function changePassword(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) return err("New password must be at least 6 characters");
  const [u] = await sql`SELECT password_hash FROM users WHERE id = ${uid}`;
  if (!u) return err("User not found", 404);
  const good = await comparePassword(String(currentPassword || ""), u.password_hash);
  if (!good) return err("Your current password is incorrect", 401);
  const hash = await hashPassword(String(newPassword));
  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${uid}`;
  return ok({ ok: true });
}

async function getTransactions(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  return ok({ transactions: await txList(uid) });
}

async function getReferrals(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  return ok({ referrals: await referralList(uid) });
}

// Health check that actually probes the database and reports its status,
// so you can confirm the DB env var is wired without guessing.
async function health(): Promise<ApiResponse> {
  const envVar = process.env.DATABASE_URL ? "DATABASE_URL" : process.env.POSTGRES_URL ? "POSTGRES_URL" : null;
  let connected = false;
  let migrated = false;
  let error: string | undefined;
  if (envVar) {
    try {
      await sql`SELECT 1`;
      connected = true;
      await ensureSchema();
      migrated = true;
    } catch (e: any) {
      error = String(e?.message || e).slice(0, 180);
    }
  }
  return ok({
    ok: connected,
    build: "2026-07-24-lazydb-guard",
    provider: getProvider().name,
    db: {
      configured: !!envVar,
      envVar,
      connected,
      migrated,
      ...(error ? { error } : {}),
    },
  });
}

// ── Public marketplace (tasks + sponsored feeds) ─────────────────────────────

async function getTasks(req: ApiRequest): Promise<ApiResponse> {
  requireAuth(req);
  const rows = await sql`SELECT id, title, detail, category, link FROM tasks WHERE active = true ORDER BY created_at ASC`;
  return ok({ tasks: rows.map((t: any) => ({ id: t.id, title: t.title, detail: t.detail, category: t.category, link: t.link })) });
}

async function getSponsored(req: ApiRequest): Promise<ApiResponse> {
  requireAuth(req);
  const rows = await sql`SELECT id, headline, copy, platform FROM sponsored WHERE status = 'active' ORDER BY created_at DESC`;
  return ok({ sponsored: rows.map((s: any) => ({ id: s.id, headline: s.headline, copy: s.copy, platform: s.platform })) });
}

// A user pays (from their deposit) to run their own sponsored post. It goes to
// the admin queue as 'pending' and only appears in the feed once approved.
const SPONSORED_MIN_BUDGET = 1000;
async function applySponsored(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const headline = String(req.body?.headline || "").trim();
  const copy = String(req.body?.copy || "").trim();
  const platform = String(req.body?.platform || "Facebook").trim() || "Facebook";
  const budget = Math.floor(Number(req.body?.budget) || 0);
  if (headline.length < 3) return err("Give your campaign a headline");
  if (copy.length < 10) return err("Write the post content advertisers will share");
  if (budget < SPONSORED_MIN_BUDGET) return err(`Minimum campaign budget is ₦${SPONSORED_MIN_BUDGET.toLocaleString()}`);

  const [u] = await sql`SELECT deposit FROM users WHERE id = ${uid}`;
  if (!u) return err("User not found", 404);
  if (num(u.deposit) < budget) return err("Insufficient deposit balance. Fund your wallet first.");

  await sql.begin(async (tx) => {
    await tx`UPDATE users SET deposit = deposit - ${budget} WHERE id = ${uid}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${uid}, 'sponsored', ${"Sponsored post: " + headline}, ${-budget}, 'deposit')`;
    await tx`
      INSERT INTO sponsored (headline, copy, platform, budget, spent, status, created_by)
      VALUES (${headline}, ${copy}, ${platform}, ${budget}, 0, 'pending', ${uid})`;
  });
  return ok({ user: await loadState(uid), transactions: await txList(uid) });
}

// ── Admin ────────────────────────────────────────────────────────────────────

async function requireAdmin(req: ApiRequest): Promise<any> {
  const uid = requireAuth(req);
  const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
  if (!u) throw new HttpError("User not found", 404);
  if (!isAdminEmail(u.email)) throw new HttpError("Admin access required", 403);
  return u;
}

async function adminOverview(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const [[users], [active], [deps], [pend], [tasks], [sponsored]] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM users`,
    sql`SELECT count(*)::int AS n FROM users WHERE plan <> 'free'`,
    sql`SELECT COALESCE(sum(amount),0) AS s FROM transactions WHERE type = 'fund'`,
    sql`SELECT count(*)::int AS n FROM payouts WHERE status = 'PENDING'`,
    sql`SELECT count(*)::int AS n FROM tasks WHERE active = true`,
    sql`SELECT count(*)::int AS n FROM sponsored WHERE status = 'pending'`,
  ]);
  const [pay] = await sql`SELECT COALESCE(sum(amount),0) AS s FROM transactions WHERE type IN ('withdraw') AND status = 'completed'`;
  return ok({
    overview: {
      users: users.n,
      activeUsers: active.n,
      totalDeposits: num(deps.s),
      totalPaidOut: Math.abs(num(pay.s)),
      pendingPayouts: pend.n,
      activeTasks: tasks.n,
      pendingSponsored: sponsored.n,
    },
  });
}

async function adminUsers(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const q = String(req.query.q || "").trim().toLowerCase();
  const rows = q
    ? await sql`
        SELECT id, name, username, email, phone, plan, engagement, sales, deposit, created_at
        FROM users WHERE lower(email) LIKE ${"%" + q + "%"} OR lower(name) LIKE ${"%" + q + "%"} OR lower(username) LIKE ${"%" + q + "%"}
        ORDER BY created_at DESC LIMIT 100`
    : await sql`
        SELECT id, name, username, email, phone, plan, engagement, sales, deposit, created_at
        FROM users ORDER BY created_at DESC LIMIT 100`;
  return ok({
    users: rows.map((u: any) => ({
      id: u.id, name: u.name, username: u.username, email: u.email, phone: u.phone,
      plan: u.plan, engagement: num(u.engagement), sales: num(u.sales), deposit: num(u.deposit),
      ts: new Date(u.created_at).getTime(),
    })),
  });
}

async function adminTransactions(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const rows = await sql`
    SELECT t.id, t.type, t.title, t.amount, t.wallet, t.status, t.created_at, u.name, u.email
    FROM transactions t JOIN users u ON u.id = t.user_id
    ORDER BY t.created_at DESC LIMIT 200`;
  return ok({
    transactions: rows.map((t: any) => ({
      id: t.id, type: t.type, title: t.title, amount: num(t.amount), wallet: t.wallet,
      status: t.status, user: t.name, email: t.email, ts: new Date(t.created_at).getTime(),
    })),
  });
}

async function adminPayouts(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const rows = await sql`
    SELECT p.id, p.reference, p.amount, p.wallet, p.bank_name, p.account_number, p.account_name, p.status, p.created_at, u.name, u.email
    FROM payouts p JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT 100`;
  return ok({
    payouts: rows.map((p: any) => ({
      id: p.id, reference: p.reference, amount: num(p.amount), wallet: p.wallet,
      bankName: p.bank_name, accountNumber: p.account_number, accountName: p.account_name,
      status: p.status, user: p.name, email: p.email, ts: new Date(p.created_at).getTime(),
    })),
  });
}

// Admin marks a queued payout as paid (settled off-platform) or rejects it (refund).
async function adminPayoutAction(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const id = String(req.body?.id || "");
  const action = String(req.body?.action || "");
  const [p] = await sql`SELECT * FROM payouts WHERE id = ${id}`;
  if (!p) return err("Payout not found", 404);
  if (p.status === "PAID" || p.status === "REJECTED") return err("This payout is already settled");

  if (action === "approve") {
    await sql.begin(async (tx) => {
      await tx`UPDATE payouts SET status = 'PAID', provider_status = 'manual' WHERE id = ${id}`;
      if (p.tx_id) await tx`UPDATE transactions SET status = 'completed' WHERE id = ${p.tx_id}`;
    });
  } else if (action === "reject") {
    await sql.begin(async (tx) => {
      if (p.wallet === "sales") await tx`UPDATE users SET sales = sales + ${num(p.amount)} WHERE id = ${p.user_id}`;
      else await tx`UPDATE users SET engagement = engagement + ${num(p.amount)} WHERE id = ${p.user_id}`;
      await tx`UPDATE payouts SET status = 'REJECTED', provider_status = 'manual' WHERE id = ${id}`;
      if (p.tx_id) await tx`DELETE FROM transactions WHERE id = ${p.tx_id}`;
    });
  } else {
    return err("Unknown action");
  }
  return ok({ ok: true });
}

async function adminTasks(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const rows = await sql`SELECT id, title, detail, category, link, active, created_at FROM tasks ORDER BY created_at DESC`;
  return ok({
    tasks: rows.map((t: any) => ({
      id: t.id, title: t.title, detail: t.detail, category: t.category, link: t.link,
      active: t.active, ts: new Date(t.created_at).getTime(),
    })),
  });
}

async function adminCreateTask(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const title = String(req.body?.title || "").trim();
  const detail = String(req.body?.detail || "").trim();
  const category = String(req.body?.category || "social").trim() || "social";
  const link = String(req.body?.link || "").trim();
  if (title.length < 3) return err("Task title is required");
  const id = `t_${Date.now().toString(36)}_${crypto.randomBytes(2).toString("hex")}`;
  await sql`INSERT INTO tasks (id, title, detail, category, link) VALUES (${id}, ${title}, ${detail}, ${category}, ${link})`;
  return ok({ ok: true, id }, 201);
}

async function adminTaskAction(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const id = String(req.body?.id || "");
  const action = String(req.body?.action || "");
  const [t] = await sql`SELECT id FROM tasks WHERE id = ${id}`;
  if (!t) return err("Task not found", 404);
  if (action === "enable") await sql`UPDATE tasks SET active = true WHERE id = ${id}`;
  else if (action === "disable") await sql`UPDATE tasks SET active = false WHERE id = ${id}`;
  else if (action === "delete") await sql`DELETE FROM tasks WHERE id = ${id}`;
  else return err("Unknown action");
  return ok({ ok: true });
}

async function adminSponsored(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const rows = await sql`
    SELECT s.id, s.headline, s.copy, s.platform, s.budget, s.spent, s.status, s.created_at, u.name AS advertiser, u.email
    FROM sponsored s LEFT JOIN users u ON u.id = s.created_by
    ORDER BY s.created_at DESC`;
  return ok({
    sponsored: rows.map((s: any) => ({
      id: s.id, headline: s.headline, copy: s.copy, platform: s.platform,
      budget: num(s.budget), spent: num(s.spent), status: s.status,
      advertiser: s.advertiser || "Official", email: s.email || "",
      ts: new Date(s.created_at).getTime(),
    })),
  });
}

async function adminCreateSponsored(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const headline = String(req.body?.headline || "").trim();
  const copy = String(req.body?.copy || "").trim();
  const platform = String(req.body?.platform || "Facebook").trim() || "Facebook";
  const budget = Math.max(0, Math.floor(Number(req.body?.budget) || 0));
  if (headline.length < 3) return err("Headline is required");
  if (copy.length < 10) return err("Post content is required");
  // Admin-created posts are official (budget 0 = unlimited) and go live immediately.
  await sql`INSERT INTO sponsored (headline, copy, platform, budget, spent, status) VALUES (${headline}, ${copy}, ${platform}, ${budget}, 0, 'active')`;
  return ok({ ok: true }, 201);
}

// Approve a user-submitted campaign (pending → active), reject it (refund the
// advertiser's budget), or end an active one (refund the unspent remainder).
async function adminSponsoredAction(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const id = String(req.body?.id || "");
  const action = String(req.body?.action || "");
  const [s] = await sql`SELECT * FROM sponsored WHERE id = ${id}`;
  if (!s) return err("Campaign not found", 404);

  if (action === "approve") {
    if (s.status !== "pending") return err("Only pending campaigns can be approved");
    await sql`UPDATE sponsored SET status = 'active' WHERE id = ${id}`;
  } else if (action === "reject") {
    if (s.status !== "pending") return err("Only pending campaigns can be rejected");
    await sql.begin(async (tx) => {
      await tx`UPDATE sponsored SET status = 'rejected' WHERE id = ${id}`;
      if (s.created_by && num(s.budget) > 0) {
        await tx`UPDATE users SET deposit = deposit + ${num(s.budget)} WHERE id = ${s.created_by}`;
        await tx`
          INSERT INTO transactions (user_id, type, title, amount, wallet)
          VALUES (${s.created_by}, 'refund', ${"Refund: " + s.headline}, ${num(s.budget)}, 'deposit')`;
      }
    });
  } else if (action === "end") {
    if (s.status !== "active") return err("Only active campaigns can be ended");
    const refund = Math.max(0, num(s.budget) - num(s.spent));
    await sql.begin(async (tx) => {
      await tx`UPDATE sponsored SET status = 'ended' WHERE id = ${id}`;
      if (s.created_by && refund > 0) {
        await tx`UPDATE users SET deposit = deposit + ${refund} WHERE id = ${s.created_by}`;
        await tx`
          INSERT INTO transactions (user_id, type, title, amount, wallet)
          VALUES (${s.created_by}, 'refund', ${"Refund (unspent): " + s.headline}, ${refund}, 'deposit')`;
      }
    });
  } else {
    return err("Unknown action");
  }
  return ok({ ok: true });
}

// ── Dispatch ────────────────────────────────────────────────────────────────

type Handler = (req: ApiRequest) => Promise<ApiResponse>;

const routes: Record<string, Handler> = {
  "POST /auth/signup": signup,
  "POST /auth/login": login,
  "GET /me": me,
  "PATCH /profile": updateProfile,
  "POST /profile/social": linkSocial,
  "POST /profile/password": changePassword,
  "POST /bank": addBank,
  "POST /earn": earn,
  "POST /plans/activate": activatePlan,
  "POST /fund/initiate": fundInitiate,
  "POST /fund/verify": fundVerify,
  "POST /deposits/nekpay/callback": nekpayCallback,
  "POST /withdraw": withdraw,
  "POST /withdrawals/naira/callback": withdrawalCallback,
  "POST /payouts/reconcile": payoutsReconcile,
  "POST /bills/pay": payBill,
  "GET /transactions": getTransactions,
  "GET /referrals": getReferrals,
  "GET /tasks": getTasks,
  "GET /sponsored": getSponsored,
  "POST /sponsored/apply": applySponsored,
  "GET /admin/overview": adminOverview,
  "GET /admin/users": adminUsers,
  "GET /admin/transactions": adminTransactions,
  "GET /admin/payouts": adminPayouts,
  "POST /admin/payouts/action": adminPayoutAction,
  "GET /admin/tasks": adminTasks,
  "POST /admin/tasks": adminCreateTask,
  "POST /admin/tasks/action": adminTaskAction,
  "GET /admin/sponsored": adminSponsored,
  "POST /admin/sponsored": adminCreateSponsored,
  "POST /admin/sponsored/action": adminSponsoredAction,
};

export async function handleApi(req: ApiRequest): Promise<ApiResponse> {
  try {
    const key = `${req.method.toUpperCase()} ${req.path}`;
    // Health check runs before ensureSchema so it can report DB status
    // even when the database isn't configured/reachable.
    if (key === "GET /health") return await health();
    await ensureSchema();
    const handler = routes[key];
    if (!handler) return err(`No route for ${key}`, 404);
    return await handler(req);
  } catch (e: any) {
    if (e instanceof HttpError) return err(e.message, e.status);
    console.error("[api] error:", e);
    return err("Something went wrong. Please try again.", 500);
  }
}
