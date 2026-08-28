"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/common/error-state";

/**
 * Dashboard-scoped error boundary. Because it sits inside the app layout, the sidebar and top
 * bar stay rendered and interactive while only the page content is replaced.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[routely] dashboard error", error);
  }, [error]);

  return <ErrorState digest={error.digest} onRetry={reset} />;
}
