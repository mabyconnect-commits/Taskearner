import crypto from "node:crypto";
import { ENV } from "./env";
import { ApiRequest, HttpError } from "./http";

// Auth implemented with Node's built-in crypto only — no external packages.
// (jsonwebtoken / bcryptjs use CommonJS dynamic require() which breaks when
// Vercel bundles the serverless function as ESM.)

export interface TokenPayload {
  uid: string;
  iat: number;
  exp: number;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

// ── JWT (HS256) ──────────────────────────────────────────────────────────────
export function signToken(uid: string, ttlSeconds = 60 * 60 * 24 * 30): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ uid, iat: now, exp: now + ttlSeconds }));
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", ENV.JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [header, payload, sig] = parts;
  const expected = crypto.createHmac("sha256", ENV.JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("invalid signature");
  const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
  if (body.exp && Math.floor(Date.now() / 1000) > body.exp) throw new Error("token expired");
  return body;
}

// ── Password hashing (scrypt) ────────────────────────────────────────────────
function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)));
  });
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(pw, salt);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function comparePassword(pw: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = String(stored).split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = await scrypt(pw, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// ── Request auth ─────────────────────────────────────────────────────────────
export function requireAuth(req: ApiRequest): string {
  const raw = req.headers["authorization"] || req.headers["Authorization"];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header || !header.startsWith("Bearer ")) throw new HttpError("Not authenticated", 401);
  try {
    return verifyToken(header.slice(7)).uid;
  } catch {
    throw new HttpError("Invalid or expired session", 401);
  }
}
