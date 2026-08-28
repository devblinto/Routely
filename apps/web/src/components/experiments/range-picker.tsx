"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarRange, Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_RANGE, RANGE_KEYS, RANGE_LABELS, type RangeKey } from "@/lib/date-range";

/**
 * Reporting window selector.
 *
 * The selection lives in the URL rather than in component state, so the view is bookmarkable,
 * shareable and survives a refresh — and so the server, which does the aggregating, is the one
 * that reads it. `useTransition` keeps the old numbers on screen while the new ones load
 * instead of flashing a skeleton over data that is about to be replaced.
 */
export function RangePicker({ value }: { value: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(next: string) {
    const params = new URLSearchParams(searchParams);

    // The default is the absence of the parameter, so a plain URL stays plain.
    if (next === DEFAULT_RANGE) params.delete("range");
    else params.set("range", next);

    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  }

  return (
    <div className="flex items-center gap-2">
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
      <Select value={value} onValueChange={select}>
        <SelectTrigger size="sm" className="w-[10.5rem]" aria-label="Reporting period">
          <CalendarRange className="size-3.5" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {RANGE_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {RANGE_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
