import "server-only";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { jwtSecret } from "@/lib/auth";

// Promoter (sub-admin) session — see the Promoter model. Its own cookie and
// payload shape: verifySessionToken() needs adminId and getStudentEmail()
// needs studentEmail, so this token unlocks neither.
export const PROMOTER_COOKIE = "notevault_promoter";
const PROMOTER_SESSION_DAYS = 30;

export const PROMOTER_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * PROMOTER_SESSION_DAYS,
};

export function signPromoterSession(promoterId: string) {
  return jwt.sign({ promoterId }, jwtSecret(), { expiresIn: `${PROMOTER_SESSION_DAYS}d` });
}

/** The signed-in promoter, re-read from the DB so deactivating one logs them out at once. */
export async function getPromoter() {
  try {
    const token = (await cookies()).get(PROMOTER_COOKIE)?.value;
    if (!token) return null;
    const { promoterId } = jwt.verify(token, jwtSecret()) as { promoterId?: string };
    if (typeof promoterId !== "string") return null;
    const promoter = await prisma.promoter.findUnique({ where: { id: promoterId }, select: { id: true, email: true, name: true, active: true } });
    return promoter?.active ? promoter : null;
  } catch {
    return null;
  }
}

/** Every grant a promoter makes is a Purchase with this utr prefix. */
export const promoterUtrPrefix = (promoterId: string) => `promoter-${promoterId}-`;
