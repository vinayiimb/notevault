import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { verifyFirebaseIdToken } from "@/lib/firebase-token";

const PROJECT = "dupyq-test";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const certs = async () => ({ k1: publicKey.export({ type: "spki", format: "pem" }).toString() });

function sign(claims: Record<string, unknown>, opts: jwt.SignOptions = {}, key = privateKey) {
  return jwt.sign({ sub: "uid1", email: "Student@Gmail.com", email_verified: true, ...claims }, key, {
    algorithm: "RS256",
    keyid: "k1",
    audience: PROJECT,
    issuer: `https://securetoken.google.com/${PROJECT}`,
    expiresIn: "1h",
    ...opts,
  });
}

test("accepts a valid token and lowercases the email", async () => {
  assert.deepEqual(await verifyFirebaseIdToken(sign({ name: "Asha" }), PROJECT, certs), { email: "student@gmail.com", name: "Asha" });
});

test("rejects wrong audience, wrong issuer, expired, unverified email, forged signature, unknown key", async () => {
  await assert.rejects(verifyFirebaseIdToken(sign({}, { audience: "other-project" }), PROJECT, certs));
  await assert.rejects(verifyFirebaseIdToken(sign({}, { issuer: "https://evil.example" }), PROJECT, certs));
  await assert.rejects(verifyFirebaseIdToken(sign({}, { expiresIn: -10 }), PROJECT, certs));
  await assert.rejects(verifyFirebaseIdToken(sign({ email_verified: false }), PROJECT, certs));
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifyFirebaseIdToken(sign({}, {}, other), PROJECT, certs));
  await assert.rejects(verifyFirebaseIdToken(sign({}, { keyid: "nope" }), PROJECT, certs));
  await assert.rejects(verifyFirebaseIdToken("not-a-jwt", PROJECT, certs));
});
