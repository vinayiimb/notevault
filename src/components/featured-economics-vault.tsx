import {
  ArrowSquareOut,
  BookOpenText,
  Exam,
  Files,
  FlagBanner,
} from "@phosphor-icons/react/dist/ssr";

const ECONOMICS_VAULT_URL =
  "https://drive.google.com/drive/folders/1GJ67aNwwfq3Mf_xBXm3POXkxduW5CDPi?usp=sharing";

export function FeaturedEconomicsVault({ className = "" }: { className?: string }) {
  return (
    <section
      aria-labelledby="economics-vault-title"
      className={`relative overflow-hidden rounded-2xl border-2 border-brand bg-brand-soft shadow-[0_10px_30px_rgba(83,88,227,.12)] ${className}`}
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-brand" />

      <div className="grid gap-7 p-6 pl-8 sm:p-8 sm:pl-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-brand">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <FlagBanner size={21} weight="fill" aria-hidden="true" />
            </span>
            Featured complete collection
          </div>

          <h2
            id="economics-vault-title"
            className="mt-5 max-w-3xl text-balance font-display text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl"
          >
            BA Economics (Hons), all in one place.
          </h2>
          <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-muted">
            One complete Drive folder with notes, previous-year question papers, and the rest of your course material.
          </p>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-foreground">
            <span className="inline-flex items-center gap-2">
              <BookOpenText size={18} weight="bold" className="text-brand" aria-hidden="true" />
              Notes
            </span>
            <span className="inline-flex items-center gap-2">
              <Exam size={18} weight="bold" className="text-brand" aria-hidden="true" />
              Previous-year papers
            </span>
            <span className="inline-flex items-center gap-2">
              <Files size={18} weight="bold" className="text-brand" aria-hidden="true" />
              Complete study material
            </span>
          </div>
        </div>

        <a
          href={ECONOMICS_VAULT_URL}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-[0_8px_20px_rgba(83,88,227,.24)] hover:-translate-y-0.5 hover:bg-brand-hover lg:w-auto"
        >
          Open complete folder
          <ArrowSquareOut
            size={17}
            weight="bold"
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </a>
      </div>
    </section>
  );
}
