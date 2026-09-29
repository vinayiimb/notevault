"use client";

import { PaperBrowser } from "@/components/archive/paper-browser";

interface Props {
  programmes: string[];
  groupedProgrammes: Record<string, string[]>;
  totalCount: number;
}

export function PapersViewTabs({ totalCount }: Props) {
  return <PaperBrowser />;
}
