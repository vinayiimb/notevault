import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-dashboard-bg" aria-label="Loading dashboard" aria-busy="true">
      {/* Sidebar Skeleton */}
      <div className="hidden w-64 border-r border-border bg-surface p-4 lg:block space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>

      {/* Main Container Skeleton */}
      <div className="flex-1 min-w-0">
        <div className="border-b border-border bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>

        <div className="mx-auto max-w-7xl p-6 space-y-8">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-8 w-64 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
