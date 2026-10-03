import { PaperTypeHub, paperTypeMetadata } from "@/components/seo/paper-type-hub";

export const revalidate = 86400;
export const metadata = paperTypeMetadata("VAC");

export default function Page() {
  return <PaperTypeHub type="VAC" />;
}
