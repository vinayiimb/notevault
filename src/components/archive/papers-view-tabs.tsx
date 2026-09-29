"use client";

import { PaperBrowser } from "@/components/archive/paper-browser";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";

interface Props {
  papers: CatalogPaper[];
  totalCount: number;
}

export function PapersViewTabs({ papers }: Props) {
  return <PaperBrowser papers={papers} />;
}
