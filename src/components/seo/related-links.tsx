import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

interface RelatedLink {
  title: string;
  url: string;
  type?: 'pyq' | 'notes' | 'test' | 'syllabus' | 'important';
}

interface Props {
  title?: string;
  links: RelatedLink[];
}

export function RelatedLinks({ title = "Students also study", links }: Props) {
  if (!links || links.length === 0) return null;

  return (
    <section className="mt-14 sm:mt-16">
      <h3 className="font-display text-[22px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[26px]">{title}</h3>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {links.map((link, i) => (
          <Link
            key={i}
            href={link.url}
            className="group flex items-center justify-between gap-3 rounded-[22px] bg-surface-muted p-5 transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]"
          >
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
                {link.title}
              </span>
              {link.type && (
                <span className="mt-1 text-[12px] font-medium uppercase tracking-wider text-muted">
                  {link.type.replace('-', ' ')}
                </span>
              )}
            </div>
            <CaretRight size={14} weight="bold" className="shrink-0 text-brand transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
