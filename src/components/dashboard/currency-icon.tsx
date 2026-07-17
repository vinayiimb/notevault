import { getSiteSettings } from "@/lib/data";

// Renders the admin-uploaded currency icon if one exists, else the default
// 🍊 emoji — used everywhere the "oranges" currency shows up.
export async function CurrencyIcon({ className }: { className?: string }) {
  const { currencyIconUrl } = await getSiteSettings();
  if (currencyIconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={currencyIconUrl}
        alt=""
        className={`inline-block object-contain ${className ?? "size-8"}`}
      />
    );
  }
  return <span className={className}>🍊</span>;
}
