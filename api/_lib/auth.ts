import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ENV } from "./env";
import { ApiRequest, HttpError } from "./http";

export interface TokenPayload {
  uid: string;
}

export function signToken(uid: string): string {
  return jwt.sign({ uid }, ENV.JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function comparePassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// Extract the authenticated user id from an Authorization: Bearer <token> header.
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
