import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Thin Razorpay client: just the two calls we need (create order, verify a
// signature). Not worth the `razorpay` npm package for this.

function keyId() {
  const v = process.env.RAZORPAY_KEY_ID;
  if (!v) throw new Error("RAZORPAY_KEY_ID is not set");
  return v;
}

function keySecret() {
  const v = process.env.RAZORPAY_KEY_SECRET;
  if (!v) throw new Error("RAZORPAY_KEY_SECRET is not set");
  return v;
}

export type RazorpayOrder = { id: string; amount: number; currency: string; notes?: Record<string, string> };

function authHeader() {
  return `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}`;
}

export async function getRazorpayOrder(orderId: string): Promise<RazorpayOrder | null> {
  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, { headers: { Authorization: authHeader() } });
  return res.ok ? res.json() : null;
}

// amount is in paise. `notes` round-trips arbitrary metadata (email, phone,
// items) to the webhook/verify step without a separate lookup table.
export async function createRazorpayOrder(amountPaise: number, notes: Record<string, string>): Promise<RazorpayOrder> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", notes }),
  });
  if (!res.ok) throw new Error(`Razorpay order creation failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function hmac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Checkout success callback on the client gives us order_id + payment_id +
// signature; this is HMAC_SHA256(order_id + "|" + payment_id, key_secret).
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  return safeEqual(hmac(`${orderId}|${paymentId}`, keySecret()), signature);
}

// Webhook body signature: HMAC_SHA256(raw body, webhook secret), header
// `x-razorpay-signature`. Needs the RAW body string, not the parsed JSON.
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false; // not configured yet — fail closed, never auto-approve unverified
  return safeEqual(hmac(rawBody, secret), signature);
}
