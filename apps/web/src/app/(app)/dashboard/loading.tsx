import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/common/loading-state";

export default function DashboardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <CardGridSkeleton />
    </>
  );
}
