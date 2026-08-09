// Server Component only — fetches the admin-uploaded currency icon URL
// itself. Never import this from a "use client" file: even importing just
// CurrencyIconDisplay from a *different* file avoids the problem, but this
// file's own top-level `getSiteSettings` -> `@/lib/prisma` import would
// still be pulled into a client bundle if this file were imported from
// one. Client components should import CurrencyIconDisplay directly
// instead (see currency-icon-display.tsx) and pass the URL down as a prop.
import { getSiteSettings } from "@/lib/data";
import { CurrencyIconDisplay } from "@/components/dashboard/currency-icon-display";

export { CurrencyIconDisplay };

export async function CurrencyIcon({ className }: { className?: string }) {
  const { currencyIconUrl } = await getSiteSettings();
  return <CurrencyIconDisplay url={currencyIconUrl} className={className} />;
}
