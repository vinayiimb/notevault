import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function VisibleBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-muted" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <CaretRight size={11} weight="bold" className="text-muted/50 shrink-0" />
            )}
            {isLast ? (
              <span className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs" aria-current="page">
                {item.name}
              </span>
            ) : (
              <Link
                href={item.url}
                className="hover:text-accent transition-colors duration-150"
              >
                {item.name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
