// Public URL construction — always the configured custom domain
// (R2_PUBLIC_BASE_URL), never a bare r2.dev URL (config.ts refuses to
// resolve if one is configured) and never proxied through a Next.js API
// route (that would put every PDF download through a serverless function's
// execution time/memory limits and egress cost for no benefit — R2's own
// custom-domain public bucket already serves the bytes directly over CDN).
import { resolveR2Config } from "./config";

export function publicUrlForKey(key: string): string {
  const config = resolveR2Config();
  return `${config.publicBaseUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}
