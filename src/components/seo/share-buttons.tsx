import { TelegramLogo, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";

/** Plain-link WhatsApp / Telegram share with pre-filled text; no JS needed. */
export function ShareButtons({ url, text }: { url: string; text: string }) {
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const cls =
    "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:border-accent/50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Share with your class:</span>
      <a href={wa} target="_blank" rel="noopener noreferrer" className={cls}>
        <WhatsappLogo size={17} weight="fill" className="text-[#25D366]" /> WhatsApp
      </a>
      <a href={tg} target="_blank" rel="noopener noreferrer" className={cls}>
        <TelegramLogo size={17} weight="fill" className="text-[#229ED9]" /> Telegram
      </a>
    </div>
  );
}
