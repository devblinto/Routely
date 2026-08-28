import { PageHeaderSkeleton } from "@/components/common/loading-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the shape of the loaded page — the configuration card, then the two result columns —
 * so the layout does not jump when the aggregation queries return.
 */
export default function ExperimentLoading() {
  return (
    <>
      <PageHeaderSkeleton />

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="mx-auto hidden size-4 sm:block" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <Card key={index}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-24" />
                <div className="space-y-3 pt-2">
                  {[0, 1, 2, 3, 4].map((row) => (
                    <Skeleton key={row} className="h-4 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
