import { Skeleton } from "@corex/ui/components/skeleton";

export function DashboardSkeleton() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-80 rounded-xl" />
        <Skeleton className="h-9 w-44 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-8 md:grid-cols-2">
        <Skeleton className="h-[220px] rounded-2xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[164px] rounded-2xl" />
          <Skeleton className="h-[164px] rounded-2xl" />
        </div>
        <Skeleton className="h-[230px] rounded-2xl" />
        <Skeleton className="h-[360px] rounded-2xl" />
      </div>
    </main>
  );
}
