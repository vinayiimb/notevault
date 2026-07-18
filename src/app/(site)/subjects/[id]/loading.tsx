import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-3 h-8 w-80" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />

      <div className="mt-10 space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
