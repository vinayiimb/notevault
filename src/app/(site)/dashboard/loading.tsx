import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-full bg-dashboard-bg" aria-label="Loading dashboard" aria-busy="true">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-col gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <Skeleton className="h-52 rounded-2xl sm:col-span-2 lg:col-span-7" />
          <Skeleton className="h-52 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-52 rounded-2xl lg:col-span-3" />
        </div>

        <Skeleton className="mt-4 h-28 rounded-2xl" />

        <div className="mt-10 space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-72 max-w-full" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
