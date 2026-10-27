// Same shell as LegalPage, minus the policy nav and "last updated" line — for /about and /contact.
export function InfoPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">{title}</h1>
      <p className="mt-4 text-pretty text-base leading-relaxed text-muted">{intro}</p>
      <div className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-foreground/85 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-2 [&_strong]:text-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
