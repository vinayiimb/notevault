import { Skeleton } from "@/components/ui/skeleton";
import { GamifiedLoader } from "@/components/ui/gamified-loader";

export default function Loading() {
  return (
    <div className="p-8">
      <GamifiedLoader size="sm" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-8 w-64" />
      <div className="mt-8 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
