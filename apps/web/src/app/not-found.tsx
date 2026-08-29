import Link from "next/link";
import { Compass } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4">
      <EmptyState
        className="w-full"
        icon={Compass}
        title="Page not found"
        description="The page you were looking for does not exist, or you no longer have access to it."
        action={
          <Button asChild>
            <Link href={routes.experiments.list}>Back to experiments</Link>
          </Button>
        }
      />
    </div>
  );
}
