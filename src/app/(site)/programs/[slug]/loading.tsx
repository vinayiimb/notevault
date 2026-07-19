import { Skeleton } from "@/components/ui/skeleton";
import { GamifiedLoader } from "@/components/ui/gamified-loader";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <GamifiedLoader size="sm" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-8 w-72" />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
