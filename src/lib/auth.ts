import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";

const SESSION_COOKIE = "notevault_session";
// Fail closed: with the public fallback anyone could forge an admin cookie.
// Read lazily so `next build` (no runtime env) still works.
export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is not set");
  return "dev-secret-change-me";
}

export type SessionPayload = {
  adminId: string;
  email: string;
  name: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret()) as Partial<SessionPayload>;
    // Student tokens share the secret — without this a student cookie pasted
    // into notevault_session would pass every admin check.
    return typeof payload.adminId === "string" ? (payload as SessionPayload) : null;
  } catch {
    return null;
  }
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch (err) {
    if (isDynamicServerError(err)) {
      throw err;
    }
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

// Login brute-force guard: 5 wrong passwords per IP+email → 15 min lockout.
// ponytail: in-memory per process — fine on one Railway instance; move to the DB if it ever scales out.
const loginFailures = new Map<string, { count: number; until: number }>();
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

export async function loginThrottleKey(email: string) {
  // Rightmost X-Forwarded-For entry is the one Railway's proxy added; earlier ones are client-supplied.
  const ip = (await headers()).get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  return `${ip}|${email}`;
}

export function isLoginLocked(key: string) {
  const f = loginFailures.get(key);
  return !!f && f.count >= MAX_LOGIN_FAILURES && f.until > Date.now();
}

export function recordLoginFailure(key: string) {
  if (loginFailures.size > 10_000) loginFailures.clear();
  const f = loginFailures.get(key);
  const count = f && f.until > Date.now() ? f.count + 1 : 1;
  loginFailures.set(key, { count, until: Date.now() + LOGIN_LOCK_MS });
}

export function clearLoginFailures(key: string) {
  loginFailures.delete(key);
}
