import jwt from "jsonwebtoken";

// Verifies a Firebase Auth ID token without firebase-admin or a service
// account: check the RS256 signature against Google's published certs, then
// audience / issuer / expiry. https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: { at: number; maxAge: number; certs: Record<string, string> } | null = null;

export async function fetchGoogleCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() - certCache.at < certCache.maxAge) return certCache.certs;
  const res = await fetch(CERTS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch Google certs (${res.status})`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600) * 1000;
  certCache = { at: Date.now(), maxAge, certs: (await res.json()) as Record<string, string> };
  return certCache.certs;
}

export type VerifiedGoogleUser = { email: string; name: string | null };

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  getCerts: () => Promise<Record<string, string>> = fetchGoogleCerts,
): Promise<VerifiedGoogleUser> {
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded && typeof decoded === "object" ? decoded.header.kid : undefined;
  const cert = kid ? (await getCerts())[kid] : undefined;
  if (!cert) throw new Error("Unknown signing key");

  const payload = jwt.verify(token, cert, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  }) as jwt.JwtPayload & { email?: string; email_verified?: boolean; name?: string };

  if (!payload.sub) throw new Error("Token has no subject");
  if (!payload.email || payload.email_verified !== true) throw new Error("Google account email is not verified");
  return { email: payload.email.trim().toLowerCase(), name: payload.name ?? null };
}
