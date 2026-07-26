import crypto from "node:crypto";
import { ensureSchema, sql, num } from "./_lib/db.js";
import { ApiRequest, ApiResponse, HttpError, ok, err, textResp } from "./_lib/http.js";
import { comparePassword, hashPassword, requireAuth, signToken } from "./_lib/auth.js";
import { PLANS, planOf, SALES_WITHDRAW_MIN, COOLDOWN_MS, WORD_ROUNDS, dailyMax, utcDay, depositTax, depositTotal, withdrawFee, withdrawNet, REFERRAL_BONUS, REFERRAL_CONFIRM_TASKS, REFERRAL_WITHDRAW_MIN } from "./_lib/plans.js";
import { loadState, serializeUser, isAdminEmail } from "./_lib/state.js";
import { getProvider } from "./_lib/payments/index.js";
import { nekpayBankCode } from "./_lib/payments/banks.js";
import { ENV } from "./_lib/env.js";
import { listBanks, resolveAccount } from "./_lib/flutterwave.js";
import {
  botEnabled, sendMessage as tgSend, editMessage as tgEdit, answerCallback as tgAnswer,
  sendToSupport, sendPhotoToSupport, mainMenu, linkButtons, setWebhook, getWebhookInfo, setMyCommands, setMenuButton,
} from "./_lib/telegram.js";

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

// Move a downline's ₦250 signup bonus from pending → available in the referrer's
// referral wallet. Idempotent: only acts while the row is still pending.
async function confirmReferralBonus(tx: any, downlineId: string, reason: string): Promise<void> {
  const [r] = await tx`
    SELECT id, referrer_id, bonus FROM referrals
    WHERE referred_id = ${downlineId} AND bonus_status = 'pending'
    FOR UPDATE`;
  if (!r || !r.referrer_id) return;
  const bonus = num(r.bonus);
  await tx`UPDATE referrals SET bonus_status = 'available' WHERE id = ${r.id}`;
  if (bonus > 0) {
    await tx`UPDATE users SET referral = referral + ${bonus} WHERE id = ${r.referrer_id}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${r.referrer_id}, 'referral', ${"Referral bonus (" + reason + ")"}, ${bonus}, 'referral')`;
  }
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
    // Each signup earns the referrer a ₦250 referral-wallet bonus, held as
    // 'pending' until this downline qualifies (25 activities or a paid upgrade).
    await sql`
      INSERT INTO referrals (referrer_id, referred_id, name, status, bonus, bonus_status)
      VALUES (${referrer.id}, ${u.id}, ${name.trim()}, 'pending', ${REFERRAL_BONUS}, 'pending')`;
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
  const { bankName, bankCode, accountNumber, accountName } = req.body || {};
  if (!bankName || !/^\d{10}$/.test(String(accountNumber || "")) || !accountName?.trim())
    return err("Provide a bank, a 10-digit account number and account name");
  await sql`
    INSERT INTO banks (user_id, bank_name, bank_code, account_number, account_name)
    VALUES (${uid}, ${bankName}, ${String(bankCode || "")}, ${accountNumber}, ${accountName.trim()})
    ON CONFLICT (user_id) DO UPDATE SET
      bank_name = EXCLUDED.bank_name,
      bank_code = EXCLUDED.bank_code,
      account_number = EXCLUDED.account_number,
      account_name = EXCLUDED.account_name,
      updated_at = now()`;
  return ok({ user: await loadState(uid) });
}

// List of Nigerian banks (name + code) for the payout bank picker.
async function banksList(req: ApiRequest): Promise<ApiResponse> {
  requireAuth(req);
  return ok({ banks: await listBanks() });
}

// Resolve an account number → account holder's name (Flutterwave).
async function resolveBankName(req: ApiRequest): Promise<ApiResponse> {
  requireAuth(req);
  const accountNumber = String(req.body?.accountNumber || "").trim();
  const bankCode = String(req.body?.bankCode || "").trim();
  if (!/^\d{10}$/.test(accountNumber)) return err("Enter a valid 10-digit account number");
  if (!bankCode) return err("Select a bank first");
  const r = await resolveAccount(accountNumber, bankCode);
  if (!r.ok) return err(r.message || "Could not verify this account");
  return ok({ accountName: r.accountName });
}

async function earn(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const { kind, refId } = req.body || {};
  const kindKey = kind as "voice" | "word" | "task" | "post";

  // Everything runs inside one transaction with the user row LOCKED (FOR UPDATE)
  // so two concurrent requests can't both pass the daily cap and double-earn.
  const amount = await sql.begin(async (tx) => {
    const [u] = await tx`SELECT * FROM users WHERE id = ${uid} FOR UPDATE`;
    if (!u) throw new HttpError("User not found", 404);
    // Free plan earns too (small daily cap) — no plan gate here anymore.
    const plan = planOf(u.plan);

    const now = Date.now();
    const cooldowns: Record<string, number> = u.cooldowns ?? {};
    const completed = u.completed ?? { tasks: [], posts: [] };

    // Daily usage: reset when the UTC day changes.
    const today = utcDay();
    const rawDaily = u.daily ?? {};
    const daily = rawDaily.date === today
      ? { date: today, earned: num(rawDaily.earned), voice: rawDaily.voice ?? 0, word: rawDaily.word ?? 0, task: rawDaily.task ?? 0, post: rawDaily.post ?? 0 }
      : { date: today, earned: 0, voice: 0, word: 0, task: 0, post: 0 };

    const capFor = (k: "voice" | "word" | "task" | "post") => plan.daily[k];
    const usedFor = (k: "voice" | "word" | "task" | "post") => daily[k];

    let amt = 0;
    let title = "";

    if (kind === "voice") {
      if ((cooldowns.voice ?? 0) > now) throw new HttpError("This activity is cooling down", 429);
      if (usedFor("voice") >= capFor("voice")) throw new HttpError("You've completed today's Voice Earn. Come back tomorrow!", 429);
      amt = plan.perVoice; title = "Voice Earn session completed";
      cooldowns.voice = now + COOLDOWN_MS;
    } else if (kind === "word") {
      if ((cooldowns.word ?? 0) > now) throw new HttpError("This activity is cooling down", 429);
      if (usedFor("word") >= capFor("word")) throw new HttpError("You've hit today's Word Game limit. Come back tomorrow!", 429);
      const count = Math.max(1, Math.min(WORD_ROUNDS, Math.floor(Number(req.body?.count) || 1)));
      amt = plan.perWord * count; title = "Word Game completed";
      cooldowns.word = now + COOLDOWN_MS;
    } else if (kind === "task") {
      if (!refId) throw new HttpError("Missing task id", 400);
      if (completed.tasks.includes(refId)) throw new HttpError("Task already completed", 409);
      if (usedFor("task") >= capFor("task")) throw new HttpError("You've reached today's task limit for your plan.", 429);
      const [t] = await tx`SELECT id FROM tasks WHERE id = ${refId} AND active = true`;
      if (!t) throw new HttpError("This task is no longer available", 404);
      amt = plan.perTask; title = "Daily task completed";
      completed.tasks = [...completed.tasks, refId];
    } else if (kind === "post") {
      if (!refId) throw new HttpError("Missing post id", 400);
      if (completed.posts.includes(refId)) throw new HttpError("Post already shared", 409);
      if (usedFor("post") >= capFor("post")) throw new HttpError("You've reached today's sponsored-post limit for your plan.", 429);
      const [sp] = await tx`SELECT * FROM sponsored WHERE id = ${refId} AND status = 'active' FOR UPDATE`;
      if (!sp) throw new HttpError("This post is no longer available", 404);
      if (num(sp.budget) > 0 && num(sp.spent) + plan.perPost > num(sp.budget)) throw new HttpError("This campaign has ended", 409);
      amt = plan.perPost; title = "Sponsored post shared";
      completed.posts = [...completed.posts, refId];
    } else {
      throw new HttpError("Unknown activity", 400);
    }

    // Enforce the plan's daily earning ceiling — never pay beyond expected funds.
    const ceiling = dailyMax(plan);
    const remaining = Math.max(0, ceiling - daily.earned);
    if (remaining <= 0) throw new HttpError("You've reached today's earning limit for your plan.", 429);
    amt = Math.min(amt, remaining);

    daily.earned += amt;
    daily[kindKey] += 1;

    await tx`
      UPDATE users SET engagement = engagement + ${amt},
        cooldowns = ${tx.json(cooldowns)}, completed = ${tx.json(completed)}, daily = ${tx.json(daily)}
      WHERE id = ${uid}`;
    await tx`
      INSERT INTO transactions (user_id, type, title, amount, wallet)
      VALUES (${uid}, ${kind}, ${title}, ${amt}, 'engagement')`;
    if (kind === "post" && refId) {
      await tx`
        UPDATE sponsored
        SET spent = spent + ${amt},
            status = CASE WHEN budget > 0 AND spent + ${amt} >= budget THEN 'ended' ELSE status END
        WHERE id = ${refId}`;
    }

    // Referral milestone: once this downline has completed REFERRAL_CONFIRM_TASKS
    // Voice tasks (one per day → ~25 days), confirm their referrer's ₦250 bonus.
    if (kind === "voice" && u.referred_by) {
      const [c] = await tx`SELECT count(*)::int AS n FROM transactions WHERE user_id = ${uid} AND type = 'voice'`;
      if ((c?.n ?? 0) >= REFERRAL_CONFIRM_TASKS) await confirmReferralBonus(tx, uid, "25 voice tasks");
    }
    return amt;
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

    // A paid upgrade instantly confirms this user's ₦250 referral-wallet bonus
    // for whoever referred them.
    if (u.referred_by) await confirmReferralBonus(tx, uid, "paid upgrade");
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

  // Try up to twice with a fresh order number — ORDER_REQUEST_FAILED is often
  // a transient gateway hiccup.
  let mchOrderNo = genOrderNo();
  let created = await provider.createOrder({
    mchOrderNo, amount: total, email: u.email,
    notifyUrl: `${ENV.APP_URL}/api/deposits/nekpay/callback`,
    pageUrl: `${ENV.APP_URL}/deposit?ref=${mchOrderNo}`,
  });
  if (!created.ok && !created.instant) {
    mchOrderNo = genOrderNo();
    created = await provider.createOrder({
      mchOrderNo, amount: total, email: u.email,
      notifyUrl: `${ENV.APP_URL}/api/deposits/nekpay/callback`,
      pageUrl: `${ENV.APP_URL}/deposit?ref=${mchOrderNo}`,
    });
  }
  if (!created.ok && !created.instant) {
    console.error("[nekpay] create order failed:", created.message);
    // Surface NEKpay's actual reason so gateway config issues are diagnosable.
    return err(`Could not start payment: ${created.message || "gateway rejected the request"}`);
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

// Safety net: re-query any recent pending deposits against NEKpay and credit
// the ones that actually paid. Runs when the user opens the app, so a deposit
// self-heals even if the gateway callback never reached us.
async function depositsReconcile(req: ApiRequest): Promise<ApiResponse> {
  const uid = requireAuth(req);
  const provider = getProvider();
  const pending = await sql`
    SELECT reference FROM payments
    WHERE user_id = ${uid} AND purpose = 'fund' AND status = 'pending'
      AND created_at > now() - interval '3 days'`;
  for (const row of pending) {
    try {
      const q = await provider.queryOrder(row.reference);
      if (q.paid) await creditDeposit(row.reference);
    } catch { /* keep going */ }
  }
  return ok({ user: await loadState(uid), transactions: await txList(uid) });
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
  const w = String(req.body?.wallet || "");
  const walletKind: "sales" | "engagement" | "referral" = w === "sales" ? "sales" : w === "referral" ? "referral" : "engagement";
  const amount = Math.floor(Number(req.body?.amount) || 0);

  const [u] = await sql`SELECT * FROM users WHERE id = ${uid}`;
  const [bank] = await sql`SELECT * FROM banks WHERE user_id = ${uid}`;
  if (!bank) return err("Add a payout bank account first");
  const plan = planOf(u.plan);
  // Engagement minimum depends on the user's plan; sales & referral are flat.
  const minWithdraw = walletKind === "sales" ? SALES_WITHDRAW_MIN : walletKind === "referral" ? REFERRAL_WITHDRAW_MIN : plan.minWithdraw;
  if (amount < minWithdraw) return err(`Minimum withdrawal is ₦${minWithdraw.toLocaleString()}`);
  const balance = walletKind === "sales" ? num(u.sales) : walletKind === "referral" ? num(u.referral) : num(u.engagement);
  if (amount > balance) return err("Insufficient balance in this wallet");

  // 3.5% tax + ₦50 VAT come off the withdrawal; the user receives the net. The
  // wallet is debited the full (gross) amount and refunded gross on failure.
  const fee = withdrawFee(amount);
  const net = withdrawNet(amount);

  const provider = getProvider();
  const transferId = genTransferId(uid);
  // Real NEKpay payout bank_code (NGR + Paystack code). null → NEKpay can't pay
  // this bank (e.g. Moniepoint/FairMoney/Carbon) → route to the manual queue.
  const nekCode = nekpayBankCode(bank.bank_name, bank.bank_code);

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

  // Reserve funds up front (debit + PENDING payout + pending ledger row), atomic.
  // The debit is conditional on sufficient balance so two concurrent withdrawals
  // can never overdraw / double-spend the same funds.
  const reserved = await sql.begin(async (tx) => {
    // Conditional debit on the chosen wallet column (identifier via sql()).
    const col = sql(walletKind);
    const debited = await tx`UPDATE users SET ${col} = ${col} - ${amount} WHERE id = ${uid} AND ${col} >= ${amount} RETURNING id`;
    if (debited.length === 0) throw new HttpError("Insufficient balance in this wallet", 400);
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
  const autoPayable = nekCode !== null && amount <= ENV.NAIRA_AUTO_MAX_NGN && relayReady;

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
    bankCode: nekCode || "",
    accountNumber: bank.account_number,
    accountName: bank.account_name,
    backUrl: `${ENV.APP_URL}/api/withdrawals/naira/callback`,
  });

  if (res.status === "failed") {
    // Explicit rejection → refund; nothing left the account.
    await sql.begin(async (tx) => {
      const col = sql(walletKind);
      await tx`UPDATE users SET ${col} = ${col} + ${amount} WHERE id = ${uid}`;
      await tx`UPDATE payouts SET status = 'REJECTED', provider_status = ${res.raw} WHERE id = ${reserved.payoutId}`;
      await tx`DELETE FROM transactions WHERE id = ${reserved.txId}`;
    });
    const why = res.message || String(res.raw || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    console.error("[nekpay] payout declined:", why, res.raw);
    return err(`Withdrawal declined: ${why || "gateway rejected the transfer"}. No funds were deducted.`);
  }

  const paid = res.status === "paid";
  await sql.begin(async (tx) => {
    await tx`UPDATE payouts SET status = ${paid ? "PAID" : "SENT"}, provider_ref = ${res.providerRef || ""}, provider_status = ${res.raw} WHERE id = ${reserved.payoutId}`;
    await tx`UPDATE transactions SET status = ${paid ? "completed" : "pending"} WHERE id = ${reserved.txId}`;
  });
  return ok({ status: paid ? "success" : "processing", receipt: receipt(paid ? "success" : "processing"), user: await loadState(uid), transactions: await txList(uid) });
}

// Settle a SENT payout by trusting only the authenticated relay query (§5c).
// Returns the classified status + raw response so callers can diagnose/report.
async function settlePayout(transferId: string): Promise<{ status: string; raw?: string }> {
  const [p] = await sql`SELECT * FROM payouts WHERE reference = ${transferId}`;
  if (!p) return { status: "not_found" };
  if (p.status === "PAID" || p.status === "REJECTED") return { status: p.status.toLowerCase() };
  const res = await getProvider().queryPayout(transferId);
  if (res.status === "paid") {
    await sql`UPDATE payouts SET status = 'PAID', provider_ref = ${res.providerRef || ""}, provider_status = ${res.raw} WHERE id = ${p.id}`;
    if (p.tx_id) await sql`UPDATE transactions SET status = 'completed' WHERE id = ${p.tx_id}`;
  } else if (res.status === "failed") {
    await sql.begin(async (tx) => {
      const col = sql(p.wallet === "sales" ? "sales" : p.wallet === "referral" ? "referral" : "engagement");
      await tx`UPDATE users SET ${col} = ${col} + ${num(p.amount)} WHERE id = ${p.user_id}`;
      await tx`UPDATE payouts SET status = 'REJECTED', provider_status = ${res.raw} WHERE id = ${p.id}`;
      if (p.tx_id) await tx`DELETE FROM transactions WHERE id = ${p.tx_id}`;
    });
  }
  // processing → leave SENT, re-query later
  return { status: res.status, raw: res.raw };
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

// Real affiliate leaderboard. Ranks by LIFETIME commission earned — the sum of
// every commission credited — not the current sales-wallet balance, so a top
// earner who has already withdrawn still shows their true total (the old query
// used u.sales, which drops to 0 after a withdrawal). Includes anyone who is
// genuinely an affiliate: has earned commission OR has at least one referral.
async function leaderboard(req: ApiRequest): Promise<ApiResponse> {
  requireAuth(req);
  const rows = await sql`
    SELECT u.name, u.username,
      COALESCE((SELECT sum(t.amount) FROM transactions t WHERE t.user_id = u.id AND t.type = 'commission'), 0) AS earned,
      (SELECT count(*)::int FROM referrals r WHERE r.referrer_id = u.id) AS refs,
      (SELECT count(*)::int FROM referrals r WHERE r.referrer_id = u.id AND r.status = 'activated') AS active_refs
    FROM users u
    WHERE EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_id = u.id)
       OR EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = u.id AND t.type = 'commission')
    ORDER BY earned DESC, active_refs DESC, refs DESC, u.created_at ASC
    LIMIT 50`;
  return ok({
    leaderboard: rows.map((u: any) => ({
      name: u.name, handle: u.username, earned: num(u.earned), refs: u.refs, activeRefs: u.active_refs,
    })),
  });
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
    build: "2026-07-24-nekpay-diag",
    provider: getProvider().name,
    db: {
      configured: !!envVar,
      envVar,
      connected,
      migrated,
      ...(error ? { error } : {}),
    },
    // Which NEKpay settings the server actually sees (values hidden; only set/MISSING).
    nekpay: {
      mchId: ENV.NEKPAY_MCH_ID ? "set" : "MISSING",
      payInKey: ENV.NEKPAY_KEY ? "set" : "MISSING",
      payType: ENV.NEKPAY_PAY_TYPE ? "set" : "MISSING",
      apiUrl: ENV.NEKPAY_API_URL,
      relayUrl: ENV.NEKPAY_RELAY_URL ? "set" : "MISSING",
      relaySecret: ENV.NEKPAY_RELAY_SECRET ? "set" : "MISSING",
    },
  });
}

// Browser-loadable diagnostic that runs the exact signup DB path (schema +
// hash + insert + serialize) and reports where it fails, as JSON.
async function selftest(): Promise<ApiResponse> {
  const steps: Record<string, string> = {};
  try { await ensureSchema(); steps.ensureSchema = "ok"; } catch (e: any) { steps.ensureSchema = "FAIL: " + String(e?.message || e).slice(0, 200); }
  let hash = "";
  try { hash = await hashPassword("selftest-password"); steps.hashPassword = "ok"; } catch (e: any) { steps.hashPassword = "FAIL: " + String(e?.message || e).slice(0, 200); }
  try {
    const email = `selftest_${Date.now()}@selftest.local`;
    const username = `selftest_${Date.now().toString(36)}`;
    const [u] = await sql`
      INSERT INTO users (name, username, email, password_hash)
      VALUES ('Self Test', ${username}, ${email}, ${hash || "x"})
      RETURNING *`;
    steps.insertUser = "ok";
    try { serializeUser(u); steps.serializeUser = "ok"; } catch (e: any) { steps.serializeUser = "FAIL: " + String(e?.message || e).slice(0, 200); }
    try { signToken(u.id); steps.signToken = "ok"; } catch (e: any) { steps.signToken = "FAIL: " + String(e?.message || e).slice(0, 200); }
    await sql`DELETE FROM users WHERE id = ${u.id}`;
    steps.cleanup = "ok";
  } catch (e: any) {
    steps.insertUser = "FAIL: " + String(e?.message || e).slice(0, 250);
  }
  const allOk = Object.values(steps).every((v) => v === "ok");
  return ok({ selftest: allOk ? "PASS" : "FAIL", build: "2026-07-24-index-rewrite", steps });
}

// ── Public marketplace (tasks + sponsored feeds) ─────────────────────────────

async function getTasks(req: ApiRequest): Promise<ApiResponse> {
  requireAuth(req);
  const rows = await sql`SELECT id, title, detail, category, link FROM tasks WHERE active = true ORDER BY created_at ASC`;
  return ok({ tasks: rows.map((t: any) => ({ id: t.id, title: t.title, detail: t.detail, category: t.category, link: t.link })) });
}

// Validate an uploaded shareable image. We store it inline as a compressed
// data: URL (no external blob storage), so only accept inline images and cap
// the size so the DB/feed stay lean.
const MAX_IMAGE_CHARS = 2_200_000; // ~1.6MB once base64-encoded
function sanitizeImage(raw: unknown): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s)) return "";
  if (s.length > MAX_IMAGE_CHARS) throw new HttpError("Image is too large — please use one under ~1.5MB", 400);
  return s;
}

async function getSponsored(req: ApiRequest): Promise<ApiResponse> {
  requireAuth(req);
  const rows = await sql`SELECT id, headline, copy, platform, image FROM sponsored WHERE status = 'active' ORDER BY created_at DESC`;
  return ok({ sponsored: rows.map((s: any) => ({ id: s.id, headline: s.headline, copy: s.copy, platform: s.platform, image: s.image || "" })) });
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
  const image = sanitizeImage(req.body?.image);
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
      INSERT INTO sponsored (headline, copy, platform, budget, spent, status, image, created_by)
      VALUES (${headline}, ${copy}, ${platform}, ${budget}, 0, 'pending', ${image}, ${uid})`;
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

// Live NEKpay gateway balance (money available in the merchant account).
async function adminBalance(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const provider = getProvider();
  try {
    const b = await provider.balance();
    return ok({ ok: b.ok, balance: b.balance, provider: provider.name });
  } catch (e: any) {
    return ok({ ok: false, balance: 0, provider: provider.name, error: String(e?.message || e).slice(0, 160) });
  }
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

// All wallet-funding attempts, with the NEKpay order id for reconciliation.
async function adminDeposits(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const rows = await sql`
    SELECT p.id, p.reference, p.amount, p.status, p.meta, p.created_at, u.name, u.email
    FROM payments p JOIN users u ON u.id = p.user_id
    WHERE p.purpose = 'fund'
    ORDER BY p.created_at DESC LIMIT 100`;
  return ok({
    deposits: rows.map((p: any) => ({
      id: p.id,
      reference: p.reference,
      nekpayId: (p.meta && p.meta.orderNo) ? String(p.meta.orderNo) : "",
      amount: num(p.amount),
      status: p.status,
      user: p.name, email: p.email,
      ts: new Date(p.created_at).getTime(),
    })),
  });
}

// Diagnostic: ask NEKpay about this order and return the raw response so we can
// see the exact fields it uses for a paid order (to fix auto-credit detection).
async function adminDepositQuery(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const id = String(req.body?.id || "");
  const [p] = await sql`SELECT * FROM payments WHERE id = ${id}`;
  if (!p) return err("Deposit not found", 404);
  const provider = getProvider();
  try {
    const q = await provider.queryOrder(p.reference);
    // If NEKpay confirms payment, credit immediately (idempotent).
    let credited = false;
    if (q.paid && p.status !== "paid") {
      await creditDeposit(p.reference);
      credited = true;
    }
    return ok({ reference: p.reference, detectedPaid: q.paid, credited, amount: q.amount, raw: q.raw });
  } catch (e: any) {
    return ok({ reference: p.reference, detectedPaid: false, error: String(e?.message || e).slice(0, 300) });
  }
}

// Force-credit a deposit that never reflected, or mark a stuck one failed.
async function adminDepositAction(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const id = String(req.body?.id || "");
  const action = String(req.body?.action || "");
  const [p] = await sql`SELECT * FROM payments WHERE id = ${id}`;
  if (!p) return err("Deposit not found", 404);

  if (action === "credit") {
    if (p.status === "paid") return err("This deposit is already credited");
    await creditDeposit(p.reference); // idempotent: credits the wallet + marks paid
  } else if (action === "fail") {
    if (p.status === "paid") return err("Already credited — cannot mark failed");
    await sql`UPDATE payments SET status = 'failed' WHERE id = ${id}`;
  } else {
    return err("Unknown action");
  }
  return ok({ ok: true });
}

async function adminPayouts(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  const rows = await sql`
    SELECT p.id, p.reference, p.provider_ref, p.amount, p.wallet, p.bank_name, p.account_number, p.account_name, p.status, p.created_at, u.name, u.email
    FROM payouts p JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT 100`;
  return ok({
    payouts: rows.map((p: any) => ({
      id: p.id, reference: p.reference, nekpayId: p.provider_ref || "", amount: num(p.amount), wallet: p.wallet,
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
      const col = sql(p.wallet === "sales" ? "sales" : p.wallet === "referral" ? "referral" : "engagement");
      await tx`UPDATE users SET ${col} = ${col} + ${num(p.amount)} WHERE id = ${p.user_id}`;
      await tx`UPDATE payouts SET status = 'REJECTED', provider_status = 'manual' WHERE id = ${id}`;
      if (p.tx_id) await tx`DELETE FROM transactions WHERE id = ${p.tx_id}`;
    });
  } else if (action === "sync") {
    // Ask NEKpay the real status and settle (SENT → PAID or REJECTED+refund).
    // NEVER re-dispatches, so it can't double-pay a delivered transfer.
    const r = await settlePayout(p.reference);
    return ok({ ok: true, status: r.status, raw: r.raw });
  } else if (action === "retry") {
    // Only a payout that was NEVER dispatched (PENDING) may be (re)sent. A SENT
    // payout is already in flight/delivered — re-query it instead of re-sending,
    // so we can never double-pay.
    if (p.status === "SENT") {
      const r = await settlePayout(p.reference);
      return ok({ ok: true, status: r.status, raw: r.raw, note: "Already sent — re-queried, not re-sent." });
    }
    const provider = getProvider();
    const nekCode = nekpayBankCode(p.bank_name);
    if (!nekCode) return err("NEKpay can't auto-pay this bank — settle it manually.");
    const net = withdrawNet(num(p.amount));
    // Atomic claim PENDING → SENT so a double-tap can't dispatch twice.
    const claim = await sql`UPDATE payouts SET status = 'SENT' WHERE id = ${id} AND status = 'PENDING' RETURNING id`;
    if (claim.length === 0) return err("This payout is no longer pending.");
    const res = await provider.payout({
      transferId: p.reference,
      amount: net,
      bankName: p.bank_name,
      bankCode: nekCode,
      accountNumber: p.account_number,
      accountName: p.account_name,
      backUrl: `${ENV.APP_URL}/api/withdrawals/naira/callback`,
    });
    if (res.status === "failed") {
      // Dispatch rejected → back to PENDING; funds stay reserved, nothing left.
      await sql`UPDATE payouts SET status = 'PENDING', provider_status = ${res.raw} WHERE id = ${id}`;
      return err(`Retry failed: ${res.message || "gateway rejected the request"}`);
    }
    const paid = res.status === "paid";
    await sql.begin(async (tx) => {
      await tx`UPDATE payouts SET status = ${paid ? "PAID" : "SENT"}, provider_ref = ${res.providerRef || ""}, provider_status = ${res.raw} WHERE id = ${id}`;
      if (p.tx_id) await tx`UPDATE transactions SET status = ${paid ? "completed" : "pending"} WHERE id = ${p.tx_id}`;
    });
    return ok({ ok: true, status: paid ? "paid" : "processing" });
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
    SELECT s.id, s.headline, s.copy, s.platform, s.budget, s.spent, s.status, s.image, s.created_at, u.name AS advertiser, u.email
    FROM sponsored s LEFT JOIN users u ON u.id = s.created_by
    ORDER BY s.created_at DESC`;
  return ok({
    sponsored: rows.map((s: any) => ({
      id: s.id, headline: s.headline, copy: s.copy, platform: s.platform,
      budget: num(s.budget), spent: num(s.spent), status: s.status, image: s.image || "",
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
  const image = sanitizeImage(req.body?.image);
  if (headline.length < 3) return err("Headline is required");
  if (copy.length < 10) return err("Post content is required");
  // Admin-created posts are official (budget 0 = unlimited) and go live immediately.
  await sql`INSERT INTO sponsored (headline, copy, platform, budget, spent, status, image) VALUES (${headline}, ${copy}, ${platform}, ${budget}, 0, 'active', ${image})`;
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

// ── Telegram support bot ─────────────────────────────────────────────────────
// A user reports "deposit not credited" / "withdrawal not received"; the bot
// tries to fix it automatically using the SAME reconcile logic the app uses
// (NEKpay queryOrder → creditDeposit for deposits; settlePayout for payouts).
// If it can't, it opens a ticket in the ops group; a staff reply of "done" /
// "success" / "paid" resolves the ticket, applies the in-app effect, and
// notifies the user.

const FAQ_TEXT =
  "<b>❓ TaskEarner — Quick Help</b>\n\n" +
  "<b>How do I earn?</b>\nOpen <b>Earn</b> and complete your daily activities (Voice, Word, Task, Sponsored post). Each pays once per day. Free earns ₦120/day; upgrade a plan to earn more.\n\n" +
  "<b>How do I fund my wallet?</b>\nTap <b>Fund Wallet</b>, enter an amount and pay. Deposits reflect automatically once confirmed — reopen the app if it takes a minute.\n\n" +
  "<b>How do withdrawals work?</b>\nAdd your bank account under <b>Withdraw</b>, then request a payout. Most banks are paid automatically; a few are settled by hand within a short while.\n\n" +
  "<b>Deposit or withdrawal stuck?</b>\nTap the button below and send the email you signed up with — I'll check it live and fix it if I can.";

async function getBotState(chatId: string): Promise<{ state: string; data: any }> {
  const [r] = await sql`SELECT state, data FROM bot_state WHERE chat_id = ${chatId}`;
  return r ? { state: r.state, data: r.data || {} } : { state: "idle", data: {} };
}
async function setBotState(chatId: string, state: string, data: any = {}): Promise<void> {
  await sql`
    INSERT INTO bot_state (chat_id, state, data, updated_at)
    VALUES (${chatId}, ${state}, ${sql.json(data)}, now())
    ON CONFLICT (chat_id) DO UPDATE SET state = EXCLUDED.state, data = EXCLUDED.data, updated_at = now()`;
}

const backToMenu = () => [[{ text: "⬅️ Back to menu", callback_data: "main_menu" }]];

// Escalate to the ops group and record the ticket. Forwards the user's payment
// proof photo when provided. Returns the ticket id.
async function escalateTicket(
  kind: "deposit" | "withdrawal",
  chatId: string,
  uname: string,
  reference: string,
  details: string,
  opts: { email?: string; photoFileId?: string } = {},
): Promise<number> {
  const email = opts.email || "";
  const [t] = await sql`
    INSERT INTO support_tickets (kind, chat_id, tg_username, email, reference, details)
    VALUES (${kind}, ${chatId}, ${uname}, ${email}, ${reference}, ${details}) RETURNING id`;
  const label = kind === "deposit" ? "Deposit not credited" : "Withdrawal not received";
  const body =
    `🎫 <b>Ticket #T${t.id}</b> — ${label}\n` +
    `From: ${uname} (chat <code>${chatId}</code>)\n` +
    (email ? `Email: <code>${maskEmail(email)}</code>\n` : "") +
    `Ref: <code>${reference || "—"}</code>\n\n${details}\n\n` +
    `↩️ <i>Reply to this message with</i> <b>done</b> / <b>success</b> / <b>paid</b> <i>to resolve and auto-notify the user.</i>`;
  const gid = opts.photoFileId
    ? await sendPhotoToSupport(opts.photoFileId, body)
    : await sendToSupport(body);
  if (gid) await sql`UPDATE support_tickets SET group_msg_id = ${gid} WHERE id = ${t.id}`;
  return t.id as number;
}

// How many deposit/withdrawal tickets for this chat are still open (unresolved).
async function openTicketCount(chatId: string, kind: "deposit" | "withdrawal"): Promise<number> {
  const [r] = await sql`SELECT count(*)::int AS n FROM support_tickets WHERE chat_id = ${chatId} AND kind = ${kind} AND status = 'open'`;
  return r?.n ?? 0;
}

// Telegram usernames allowed to resolve tickets + use admin commands.
function isBotAdmin(username?: string | null): boolean {
  if (!username) return false;
  return ENV.TELEGRAM_ADMINS.includes(String(username).replace(/^@/, "").toLowerCase());
}

const ADMIN_HELP =
  "🔐 <b>Admin commands</b>\n\n" +
  "<code>/find email@example.com</code> — look up a user's deposits &amp; latest withdrawal, with one-tap Credit / Mark-paid buttons.\n\n" +
  "You can also reply <b>done</b> to any ticket in the ops group to resolve it and auto-notify the user.";

// Admin lookup: show a user's pending deposits + latest payout with actions.
async function adminFind(chatId: string, email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(clean)) {
    await tgSend(chatId, "Usage: <code>/find email@example.com</code>");
    return;
  }
  const [u] = await sql`SELECT id, name, username FROM users WHERE lower(email) = ${clean}`;
  if (!u) {
    await tgSend(chatId, `No account found for <b>${clean}</b>.`);
    return;
  }
  const pend = await sql`SELECT reference, amount FROM payments WHERE user_id = ${u.id} AND purpose = 'fund' AND status = 'pending'`;
  const pendTotal = pend.reduce((s: number, p: any) => s + num(p.amount), 0);
  const [payout] = await sql`SELECT reference, amount, bank_name, account_number, status FROM payouts WHERE user_id = ${u.id} ORDER BY created_at DESC LIMIT 1`;

  let body = `👤 <b>${u.name}</b> (@${u.username})\nEmail: <code>${clean}</code>\n\n`;
  body += `💰 Pending deposits: <b>${pend.length}</b> totalling <b>${formatNgn(pendTotal)}</b>\n`;
  if (payout) body += `💸 Latest payout: <b>${formatNgn(num(payout.amount))}</b> → ${payout.bank_name} (${payout.account_number}) — <b>${payout.status}</b>\n`;
  else body += `💸 No withdrawals yet.\n`;

  const buttons: { text: string; callback_data: string }[][] = [];
  if (pend.length > 0) buttons.push([{ text: `✅ Credit deposits (${formatNgn(pendTotal)})`, callback_data: `credit:${clean}` }]);
  if (payout && payout.status !== "PAID" && payout.status !== "REJECTED") buttons.push([{ text: `✅ Mark payout PAID`, callback_data: `markpaid:${clean}` }]);
  await tgSend(chatId, body, buttons.length ? buttons : undefined);
}

// Admin action: force-credit all of a user's pending deposits.
async function adminCreditDeposits(email: string): Promise<{ n: number; total: number }> {
  const [u] = await sql`SELECT id FROM users WHERE lower(email) = ${email}`;
  if (!u) return { n: 0, total: 0 };
  const pend = await sql`SELECT reference, amount FROM payments WHERE user_id = ${u.id} AND purpose = 'fund' AND status = 'pending'`;
  let total = 0;
  for (const p of pend) { await creditDeposit(p.reference); total += num(p.amount); }
  return { n: pend.length, total };
}

// Admin action: mark a user's latest in-flight payout PAID.
async function adminMarkPayoutPaid(email: string): Promise<{ ok: boolean; amount: number }> {
  const [u] = await sql`SELECT id FROM users WHERE lower(email) = ${email}`;
  if (!u) return { ok: false, amount: 0 };
  const [p] = await sql`SELECT * FROM payouts WHERE user_id = ${u.id} AND status NOT IN ('PAID','REJECTED') ORDER BY created_at DESC LIMIT 1`;
  if (!p) return { ok: false, amount: 0 };
  await sql.begin(async (tx) => {
    await tx`UPDATE payouts SET status = 'PAID', provider_status = 'admin-bot' WHERE id = ${p.id}`;
    if (p.tx_id) await tx`UPDATE transactions SET status = 'completed' WHERE id = ${p.tx_id}`;
  });
  return { ok: true, amount: num(p.amount) };
}

// Mask an email for display in the ops group (keep enough to identify).
function maskEmail(e?: string | null): string {
  const s = String(e || "");
  const [name, domain] = s.split("@");
  if (!domain) return s;
  return `${name.slice(0, 1)}***@${domain}`;
}

// Find a user by the email or phone they typed (phone matched on last 10 digits
// so +234 / leading-0 formatting doesn't matter).
async function findUserByContact(contact: string): Promise<any | null> {
  const c = contact.trim();
  if (c.includes("@")) {
    const [u] = await sql`SELECT id, email FROM users WHERE lower(email) = ${c.toLowerCase()}`;
    return u || null;
  }
  const digits = c.replace(/\D/g, "");
  if (digits.length >= 7) {
    const last10 = digits.slice(-10);
    const [u] = await sql`SELECT id, email FROM users WHERE regexp_replace(phone, '\D', '', 'g') LIKE ${"%" + last10}`;
    return u || null;
  }
  return null;
}

// Step 1 — contact: identify the user by email or phone.
async function depContact(chatId: string, uname: string, contact: string): Promise<void> {
  const u = await findUserByContact(contact);
  if (!u) {
    await tgSend(chatId, "I couldn't find an account with that. Please send the exact <b>email or phone number</b> on your account.", backToMenu());
    return; // stay in dep_contact
  }
  await setBotState(chatId, "dep_amount", { userId: u.id });
  await tgSend(chatId, "How much <b>EXACTLY</b> did you pay? Send numbers only (e.g. <code>5000</code>) — it must match your order amount exactly.", backToMenu());
}

// Whether an entered amount matches a payment (base, stored total, or base+tax).
function amountMatches(p: any, amount: number): boolean {
  const base = num(p.amount);
  const metaTotal = p.meta && p.meta.total ? num(p.meta.total) : 0;
  return base === amount || metaTotal === amount || depositTotal(base) === amount;
}

// Step 2 — amount: find the exact PENDING/FAILED order for that amount.
async function depAmount(chatId: string, uname: string, amountText: string, data: any): Promise<void> {
  const amount = Math.floor(Number(String(amountText).replace(/[^\d.]/g, "")) || 0);
  if (amount < 1) {
    await tgSend(chatId, "Please send the exact amount in <b>numbers only</b>, e.g. <code>5000</code>.", backToMenu());
    return; // stay in dep_amount
  }
  const userId = data?.userId;
  if (!userId) {
    await setBotState(chatId, "dep_contact");
    await tgSend(chatId, "Let's start again — send the <b>email or phone</b> on your account.", backToMenu());
    return;
  }
  const rows = await sql`
    SELECT reference, amount, status, meta FROM payments
    WHERE user_id = ${userId} AND purpose = 'fund' AND created_at > now() - interval '30 days'
    ORDER BY created_at DESC`;
  const paidMatch = rows.find((p: any) => p.status === "paid" && amountMatches(p, amount));
  if (paidMatch) {
    await setBotState(chatId, "idle");
    await tgSend(chatId, `✅ Good news — your <b>${formatNgn(amount)}</b> deposit is <b>already credited</b> to your wallet. Reopen the app and pull down to refresh.`, backToMenu());
    return;
  }
  const pendMatch = rows.find((p: any) => (p.status === "pending" || p.status === "failed") && amountMatches(p, amount));
  if (!pendMatch) {
    await tgSend(chatId, `I couldn't find a <b>${formatNgn(amount)}</b> order on your account. Open the app → <b>Fund Wallet</b> → enter exactly <b>${formatNgn(amount)}</b> to create the order, then come back and try again.`, backToMenu());
    return; // stay in dep_amount so they can retry
  }
  await setBotState(chatId, "dep_receipt", { userId, matchedRef: pendMatch.reference, matchedAmount: amount });
  await tgSend(chatId, `Great — I found your <b>${formatNgn(amount)}</b> order. 📸 Now send your <b>receipt as a PHOTO</b> — not a file.`, backToMenu());
}

// Step 3 — receipt: require a photo, auto-verify, else escalate WITH the image.
async function depReceipt(chatId: string, uname: string, msg: any, data: any): Promise<void> {
  if (msg.document) {
    await tgSend(chatId, "Please send it as a <b>PHOTO</b> 📸, not a file.");
    return; // stay in dep_receipt
  }
  const photo = Array.isArray(msg.photo) && msg.photo.length ? msg.photo[msg.photo.length - 1] : null;
  if (!photo?.file_id) {
    await tgSend(chatId, "Send the receipt as a <b>PHOTO</b> 📸.");
    return; // stay in dep_receipt
  }
  const fileId = String(photo.file_id);
  const matchedRef = data?.matchedRef;
  const amount = num(data?.matchedAmount);
  const userId = data?.userId;
  if (!matchedRef || !userId) {
    await setBotState(chatId, "dep_contact");
    await tgSend(chatId, "Let's start again — send the <b>email or phone</b> on your account.", backToMenu());
    return;
  }
  await setBotState(chatId, "idle");
  await tgSend(chatId, "🔎 Checking your payment…");

  // AUTO-FIX FIRST: re-verify with the gateway and credit if confirmed.
  try {
    const q = await getProvider().queryOrder(matchedRef);
    if (q.paid) {
      await creditDeposit(matchedRef);
      const [p] = await sql`SELECT amount FROM payments WHERE reference = ${matchedRef}`;
      await tgSend(chatId, `✅ Fixed! <b>${formatNgn(num(p?.amount) || amount)}</b> credited to your wallet. 🎉`, backToMenu());
      return;
    }
  } catch (e) {
    console.error("[bot] deposit verify failed:", e);
  }

  // STILL UNCONFIRMED → escalate with the receipt photo (max 2 per order).
  const [oc] = await sql`SELECT count(*)::int AS n FROM support_tickets WHERE reference = ${matchedRef} AND kind = 'deposit' AND status = 'open'`;
  if ((oc?.n ?? 0) >= 2) {
    await tgSend(chatId, "⏳ This deposit has already been escalated <b>twice</b> and is under review. Please wait — you'll be notified here.", backToMenu());
    return;
  }
  const [u] = await sql`SELECT email FROM users WHERE id = ${userId}`;
  const email = u?.email || "";
  const resend = (oc?.n ?? 0) === 1;
  const details = `Amount: <b>${formatNgn(amount)}</b> — user says paid, gateway hasn't confirmed.${resend ? "\n🔁 Re-sent with a new receipt." : ""}\nPlease verify the receipt and reply <b>done</b>.`;
  const id = await escalateTicket("deposit", chatId, uname, matchedRef, details, { email, photoFileId: fileId });
  await tgSend(chatId, `✅ Sent your receipt to support — <b>ticket #T${id}</b>. You'll be messaged the moment it's credited.`, backToMenu());
}

// Withdrawal help: accept the registered email (or a reference) and check the
// user's latest payout for them.
async function botHandleWithdrawal(chatId: string, uname: string, input: string): Promise<void> {
  await setBotState(chatId, "idle");
  const val = input.trim();
  if (/^\S+@\S+\.\S+$/.test(val)) return botWithdrawByEmail(chatId, uname, val.toLowerCase());
  if (/^gp_/i.test(val.replace(/\s+/g, ""))) return botWithdrawByRef(chatId, uname, val);
  // Neither a valid email nor a gp_… reference → ask again for the email.
  await setBotState(chatId, "await_withdraw_ref");
  await tgSend(chatId, "Please send the <b>email you signed up with</b> (for example <code>name@example.com</code>) so I can find your withdrawal.", backToMenu());
}

// Look up a user by email, settle any in-flight payouts, and report the latest.
async function botWithdrawByEmail(chatId: string, uname: string, email: string): Promise<void> {
  const [u] = await sql`SELECT id FROM users WHERE lower(email) = ${email}`;
  if (!u) {
    await tgSend(chatId, `I couldn't find an account with <b>${email}</b>. Please send the exact email you used to sign up on the app, or tap 💸 to try again.`, backToMenu());
    return;
  }
  // Re-query anything still in flight (never re-sends money).
  const inflight = await sql`SELECT reference FROM payouts WHERE user_id = ${u.id} AND status = 'SENT'`;
  for (const row of inflight) { try { await settlePayout(row.reference); } catch { /* keep going */ } }

  const [p] = await sql`SELECT * FROM payouts WHERE user_id = ${u.id} ORDER BY created_at DESC LIMIT 1`;
  if (!p) {
    await tgSend(chatId, `I don't see any withdrawal on this account yet. If you requested one from a different account, send that account's email.`, backToMenu());
    return;
  }
  if (p.status === "PAID") {
    await tgSend(chatId, `✅ Your latest withdrawal of <b>${formatNgn(num(p.amount))}</b> to ${p.bank_name} (${p.account_number}) is marked <b>PAID</b>. If your bank hasn't shown it, it usually lands within minutes.`, backToMenu());
    return;
  }
  if (p.status === "REJECTED") {
    await tgSend(chatId, `Your last withdrawal was declined and the <b>${formatNgn(num(p.amount))}</b> was refunded to your wallet. You can request it again from the app.`, backToMenu());
    return;
  }
  // Don't re-forward a withdrawal that's already with the team.
  const open = await openTicketCount(chatId, "withdrawal");
  if (open >= 1) {
    await tgSend(chatId, `📌 Your withdrawal of <b>${formatNgn(num(p.amount))}</b> is <b>already with our payments team</b> and being reviewed. Please hold on — you'll be notified here once it's paid. 🙏`, backToMenu());
    return;
  }
  const id = await escalateTicket("withdrawal", chatId, uname, p.reference,
    `User <b>${email}</b> latest payout ${formatNgn(num(p.amount))} to ${p.bank_name} (${p.account_number}) is <b>${p.status}</b>. Please verify/pay and reply done.`,
    { email });
  await tgSend(chatId, `Your latest withdrawal of <b>${formatNgn(num(p.amount))}</b> to ${p.bank_name} is still <b>${String(p.status).toLowerCase()}</b>. I've opened <b>ticket #T${id}</b> and escalated it — I'll message you here the moment it's paid.`, backToMenu());
}

// Fallback: auto-fix a withdrawal by its gp_… reference.
async function botWithdrawByRef(chatId: string, uname: string, ref: string): Promise<void> {
  const cleaned = ref.replace(/\s+/g, "").trim();
  const [p] = await sql`SELECT * FROM payouts WHERE reference = ${cleaned}`;
  if (!p) {
    const id = await escalateTicket("withdrawal", chatId, uname, cleaned, "No matching payout found for this reference — user says they haven't received it.");
    await tgSend(chatId, `I couldn't find a withdrawal with reference <code>${cleaned}</code>. I've opened <b>ticket #T${id}</b> and our payments team will check it. You'll hear back here.`, backToMenu());
    return;
  }
  if (p.status === "PAID") {
    await tgSend(chatId, `✅ This withdrawal of <b>${formatNgn(num(p.amount))}</b> is marked <b>PAID</b> on our side to ${p.bank_name} (${p.account_number}). If your bank hasn't shown it, it usually lands within a few minutes.`, backToMenu());
    return;
  }
  if (p.status === "REJECTED") {
    await tgSend(chatId, `This withdrawal was declined and the <b>${formatNgn(num(p.amount))}</b> was refunded back to your wallet. You can try again from the app.`, backToMenu());
    return;
  }
  // SENT/PENDING → re-query the relay and settle (never re-sends money).
  try {
    const r = await settlePayout(cleaned);
    if (r.status === "paid") {
      await tgSend(chatId, `✅ Sorted! Your <b>${formatNgn(num(p.amount))}</b> withdrawal is confirmed <b>PAID</b> to ${p.bank_name} (${p.account_number}). 🎉`, backToMenu());
      return;
    }
    if (r.status === "failed") {
      await tgSend(chatId, `This transfer failed and the <b>${formatNgn(num(p.amount))}</b> has been refunded to your wallet. You can request it again.`, backToMenu());
      return;
    }
  } catch (e) {
    console.error("[bot] payout settle failed:", e);
  }
  const id = await escalateTicket("withdrawal", chatId, uname, cleaned, `Payout of ${formatNgn(num(p.amount))} to ${p.bank_name} (${p.account_number}) is still <b>${p.status}</b>. Please verify with NEKpay and reply done once paid.`);
  await tgSend(chatId, `Your <b>${formatNgn(num(p.amount))}</b> withdrawal is still processing. I've opened <b>ticket #T${id}</b> and escalated it to our payments team — I'll message you here the moment it's paid.`, backToMenu());
}

// Apply the real in-app effect when staff resolve a ticket (trusted ops action).
async function applyTicketResolution(t: any): Promise<void> {
  try {
    if (t.kind === "deposit") {
      // Credit exactly the references that were escalated (comma-joined). Staff
      // replying "done" means they verified the payment(s).
      const refs = String(t.reference || "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const ref of refs) {
        const [p] = await sql`SELECT * FROM payments WHERE reference = ${ref} AND purpose = 'fund'`;
        if (p && p.status !== "paid") await creditDeposit(p.reference); // idempotent
      }
    } else if (t.kind === "withdrawal" && t.reference) {
      const [p] = await sql`SELECT * FROM payouts WHERE reference = ${t.reference}`;
      if (p && p.status !== "PAID" && p.status !== "REJECTED") {
        await sql.begin(async (tx) => {
          await tx`UPDATE payouts SET status = 'PAID', provider_status = 'support-resolved' WHERE id = ${p.id}`;
          if (p.tx_id) await tx`UPDATE transactions SET status = 'completed' WHERE id = ${p.tx_id}`;
        });
      }
    }
  } catch (e) {
    console.error("[bot] applyTicketResolution failed:", e);
  }
}

// A staff message inside the ops group: a reply to a ticket resolves it.
async function botHandleGroupMessage(msg: any): Promise<void> {
  const text = String(msg.text || msg.caption || "").trim();
  if (/^\/id\b/.test(text)) {
    await tgSend(msg.chat.id, `chat_id: <code>${msg.chat.id}</code>`);
    return;
  }
  const reply = msg.reply_to_message;
  if (!reply) return; // ignore ordinary group chatter
  const [t] = await sql`SELECT * FROM support_tickets WHERE group_msg_id = ${reply.message_id}`;
  if (!t) return;
  // Only bot admins may resolve tickets / relay updates to users.
  if (!isBotAdmin(msg.from?.username)) return;
  const resolved = /(done|success|paid|credited|resolved|settled|fixed|complete|✅)/i.test(text);
  if (!resolved) {
    // Relay staff's note to the user without closing the ticket.
    if (text) await tgSend(t.chat_id, `📩 <b>Support update</b> on ticket #T${t.id}:\n${text}`);
    return;
  }
  if (t.status === "resolved") {
    await tgSend(msg.chat.id, `Ticket #T${t.id} is already resolved.`);
    return;
  }
  await sql`UPDATE support_tickets SET status = 'resolved' WHERE id = ${t.id}`;
  await applyTicketResolution(t);
  // Tell the user, with the amount when we can compute it.
  let amountStr = "";
  if (t.kind === "deposit") {
    const refs = String(t.reference || "").split(",").map((s) => s.trim()).filter(Boolean);
    let sum = 0;
    for (const ref of refs) {
      const [r] = await sql`SELECT amount FROM payments WHERE reference = ${ref}`;
      if (r) sum += num(r.amount);
    }
    if (sum > 0) amountStr = ` ${formatNgn(sum)}`;
    await tgSend(t.chat_id, `✅ <b>Your deposit is fixed!</b>${amountStr} has been credited to your wallet. Reopen the app to see it. Thanks for your patience! 🙏`, mainMenu());
  } else {
    const [p] = t.reference ? await sql`SELECT amount FROM payouts WHERE reference = ${t.reference}` : [null];
    if (p) amountStr = ` of ${formatNgn(num(p.amount))}`;
    await tgSend(t.chat_id, `✅ <b>Your withdrawal${amountStr} is sorted!</b> It has been marked paid. Thanks for your patience! 🙏`, mainMenu());
  }
  await tgSend(msg.chat.id, `Ticket #T${t.id} resolved ✅ — user notified.`);
}

async function botHandleCallback(cq: any): Promise<void> {
  const chatId = String(cq.message?.chat?.id || "");
  const data = String(cq.data || "");
  await tgAnswer(cq.id);
  if (!chatId) return;

  // Admin one-tap actions from /find (admin-only).
  if (data.startsWith("credit:") || data.startsWith("markpaid:")) {
    if (!isBotAdmin(cq.from?.username)) { await tgSend(chatId, "Admins only."); return; }
    const email = data.slice(data.indexOf(":") + 1);
    if (data.startsWith("credit:")) {
      const r = await adminCreditDeposits(email);
      await tgSend(chatId, r.n ? `✅ Credited <b>${formatNgn(r.total)}</b> across ${r.n} deposit(s) for <code>${email}</code>.` : `No pending deposits for <code>${email}</code>.`);
    } else {
      const r = await adminMarkPayoutPaid(email);
      await tgSend(chatId, r.ok ? `✅ Marked <b>${formatNgn(r.amount)}</b> payout as PAID for <code>${email}</code>.` : `No in-flight payout for <code>${email}</code>.`);
    }
    return;
  }

  if (data === "deposit_issue") {
    await setBotState(chatId, "dep_contact");
    await tgSend(chatId, "🆘 <b>Deposit not credited</b>\n\nSend the <b>email or phone number</b> on your account.", backToMenu());
  } else if (data === "withdrawal_issue") {
    await setBotState(chatId, "await_withdraw_ref");
    await tgSend(chatId, "💸 <b>Withdrawal not received</b>\n\nSend me the <b>email you signed up with</b> on the app. I'll check your latest withdrawal and confirm its status.", backToMenu());
  } else if (data === "faq_menu") {
    await tgEdit(chatId, cq.message.message_id, FAQ_TEXT, [...backToMenu(), ...linkButtons()]);
  } else if (data === "main_menu") {
    await setBotState(chatId, "idle");
    await tgEdit(chatId, cq.message.message_id, "How can I help you today? 👇", mainMenu());
  }
}

async function botHandleMessage(msg: any): Promise<void> {
  const chatId = String(msg.chat?.id || "");
  if (!chatId) return;
  const text = String(msg.text || "").trim();

  // Messages inside the ops/support group are handled separately (staff replies).
  if (ENV.TELEGRAM_SUPPORT_GROUP_ID && chatId === ENV.TELEGRAM_SUPPORT_GROUP_ID) {
    await botHandleGroupMessage(msg);
    return;
  }
  // Slash command (strip any @BotName suffix, lowercase) → quick actions.
  const cmd = text.startsWith("/") ? text.split(/\s+/)[0].replace(/@.*$/, "").toLowerCase() : "";
  const uname = msg.from?.username ? "@" + msg.from.username : (msg.from?.first_name || "user");

  if (cmd === "/id") {
    await tgSend(chatId, `chat_id: <code>${chatId}</code>`);
    return;
  }
  if (cmd === "/start" || cmd === "/menu" || cmd === "/help" || cmd === "/support") {
    await setBotState(chatId, "idle");
    const who = msg.from?.first_name ? ` ${msg.from.first_name}` : "";
    await tgSend(chatId, `👋 Hi${who}! I'm the <b>TaskEarner Support Bot</b>. I can check a stuck deposit or withdrawal and fix it on the spot. What do you need?`, mainMenu());
    return;
  }
  if (cmd === "/deposit") {
    await setBotState(chatId, "dep_contact");
    await tgSend(chatId, "🆘 <b>Deposit not credited</b>\n\nSend the <b>email or phone number</b> on your account.", backToMenu());
    return;
  }
  if (cmd === "/withdraw" || cmd === "/withdrawal") {
    await setBotState(chatId, "await_withdraw_ref");
    await tgSend(chatId, "💸 <b>Withdrawal not received</b>\n\nSend me the <b>email you signed up with</b> on the app. I'll check your latest withdrawal and confirm its status.", backToMenu());
    return;
  }
  if (cmd === "/faq") {
    await setBotState(chatId, "idle");
    await tgSend(chatId, FAQ_TEXT, [...backToMenu(), ...linkButtons()]);
    return;
  }
  // Admin-only commands.
  if (cmd === "/admin") {
    await tgSend(chatId, isBotAdmin(msg.from?.username) ? ADMIN_HELP : "This command is for admins only.");
    return;
  }
  if (cmd === "/find") {
    if (!isBotAdmin(msg.from?.username)) { await tgSend(chatId, "This command is for admins only."); return; }
    await adminFind(chatId, text.split(/\s+/)[1] || "");
    return;
  }
  const st = await getBotState(chatId);
  if (st.state === "dep_contact") { await depContact(chatId, uname, text); return; }
  if (st.state === "dep_amount") { await depAmount(chatId, uname, text, st.data); return; }
  if (st.state === "dep_receipt") { await depReceipt(chatId, uname, msg, st.data); return; }
  if (st.state === "await_withdraw_ref") { await botHandleWithdrawal(chatId, uname, text); return; }
  await tgSend(chatId, "Tap a button below and I'll help you out 👇", mainMenu());
}

// Telegram webhook. Always returns 200 "ok" so Telegram never retry-storms us;
// all real work happens best-effort inside try/catch.
async function telegramWebhook(req: ApiRequest): Promise<ApiResponse> {
  if (!botEnabled()) return textResp("ok", 200);
  if (ENV.TELEGRAM_WEBHOOK_SECRET) {
    const got = String(req.headers["x-telegram-bot-api-secret-token"] || "");
    if (got !== ENV.TELEGRAM_WEBHOOK_SECRET) return textResp("ok", 200); // ignore spoofed calls
  }
  const update = (req.body && typeof req.body === "object") ? req.body : {};
  try {
    if (update.callback_query) await botHandleCallback(update.callback_query);
    else if (update.message) await botHandleMessage(update.message);
  } catch (e) {
    console.error("[telegram] webhook handler error:", e);
  }
  return textResp("ok", 200);
}

// Admin: register the Telegram webhook and report its status (one-tap setup).
async function adminTelegramSetup(req: ApiRequest): Promise<ApiResponse> {
  await requireAdmin(req);
  if (!botEnabled()) return err("Set TELEGRAM_BOT_TOKEN first");
  // Register on the canonical www host (APP_PUBLIC_URL) with no trailing slash —
  // the apex domain 308-redirects to www, and www serves the slash-less path
  // directly. Either redirect would make Telegram reject the response.
  const base = (String(req.body?.url || ENV.APP_PUBLIC_URL || ENV.APP_URL) || "").replace(/\/+$/, "");
  const hookUrl = `${base}/api/telegram/webhook`;
  const set = await setWebhook(hookUrl, ENV.TELEGRAM_WEBHOOK_SECRET);
  // Also register the command list + Menu button (the in-chat quick actions).
  await setMyCommands();
  await setMenuButton();
  const info = await getWebhookInfo();
  return ok({
    ok: !!set?.ok,
    webhookUrl: hookUrl,
    setResult: set,
    info: info?.result || info,
    supportGroup: ENV.TELEGRAM_SUPPORT_GROUP_ID ? "set" : "MISSING",
  });
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
  "GET /banks/list": banksList,
  "POST /bank/resolve": resolveBankName,
  "POST /earn": earn,
  "POST /plans/activate": activatePlan,
  "POST /fund/initiate": fundInitiate,
  "POST /fund/verify": fundVerify,
  "POST /deposits/reconcile": depositsReconcile,
  "POST /deposits/nekpay/callback": nekpayCallback,
  "POST /withdraw": withdraw,
  "POST /withdrawals/naira/callback": withdrawalCallback,
  "POST /payouts/reconcile": payoutsReconcile,
  "POST /bills/pay": payBill,
  "GET /transactions": getTransactions,
  "GET /referrals": getReferrals,
  "GET /leaderboard": leaderboard,
  "GET /tasks": getTasks,
  "GET /sponsored": getSponsored,
  "POST /sponsored/apply": applySponsored,
  "GET /admin/overview": adminOverview,
  "GET /admin/balance": adminBalance,
  "GET /admin/users": adminUsers,
  "GET /admin/transactions": adminTransactions,
  "GET /admin/deposits": adminDeposits,
  "POST /admin/deposits/action": adminDepositAction,
  "POST /admin/deposits/query": adminDepositQuery,
  "GET /admin/payouts": adminPayouts,
  "POST /admin/payouts/action": adminPayoutAction,
  "GET /admin/tasks": adminTasks,
  "POST /admin/tasks": adminCreateTask,
  "POST /admin/tasks/action": adminTaskAction,
  "GET /admin/sponsored": adminSponsored,
  "POST /admin/sponsored": adminCreateSponsored,
  "POST /admin/sponsored/action": adminSponsoredAction,
  "POST /admin/telegram/setup": adminTelegramSetup,
  "POST /telegram/webhook": telegramWebhook,
};

export async function handleApi(req: ApiRequest): Promise<ApiResponse> {
  try {
    const key = `${req.method.toUpperCase()} ${req.path}`;
    // Health check runs before ensureSchema so it can report DB status
    // even when the database isn't configured/reachable.
    if (key === "GET /health") return await health();
    if (key === "GET /selftest") return await selftest();
    // Two-segment GET to confirm nested paths reach the function (routing test).
    if (key === "GET /diag/ping") return ok({ pong: true, path: req.path, build: "2026-07-24-index-rewrite" });
    await ensureSchema();
    const handler = routes[key];
    if (!handler) return err(`No route for ${key}`, 404);
    return await handler(req);
  } catch (e: any) {
    if (e instanceof HttpError) return err(e.message, e.status);
    console.error("[api] error:", e);
    // Surface the real reason (DB errors etc.) so failures aren't a blank
    // "Request failed". Messages here are diagnostic, not secrets.
    return err(`Server error: ${String(e?.message || e).slice(0, 200)}`, 500);
  }
}
