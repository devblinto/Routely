"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowDownWideNarrow, Filter, Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Tabs, search, sort and type filter for the metrics list.
 *
 * Everything lives in the URL, so the view is bookmarkable and the filtering happens in the
 * database — the same choice the experiments list makes, and for the same reason: holding
 * every row client-side gets slower exactly as a customer accumulates goals.
 */

const DEBOUNCE_MS = 300;

export interface MetricTab {
  key: string;
  label: string;
  count: number;
}

export function MetricsFilters({
  tabs,
  tab,
  search,
  type,
  sort,
  types,
  total,
}: {
  tabs: MetricTab[];
  tab: string;
  search: string;
  type: string;
  sort: string;
  types: { key: string; label: string }[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [term, setTerm] = useState(search);

  function push(next: URLSearchParams) {
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
  }

  function set(key: string, value: string, fallback: string) {
    const params = new URLSearchParams(searchParams);
    if (value === fallback) params.delete(key);
    else params.set(key, value);
    push(params);
  }

  // Debounced, and skipped when the term already matches the URL — otherwise the effect fires
  // a redundant navigation on every render the navigation itself caused.
  useEffect(() => {
    if (term === search) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (term.trim()) params.set("q", term.trim());
      else params.delete("q");
      push(params);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="space-y-4 border-b border-border p-4">
      <div className="flex flex-wrap items-center gap-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => set("tab", item.key, "summary")}
            aria-current={item.key === tab ? "page" : undefined}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              item.key === tab
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {item.label}
            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search metrics…"
            aria-label="Search metrics"
            className="pl-9"
          />
          {isPending ? (
            <Loader2
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </div>

        <Select value={sort} onValueChange={(value) => set("sort", value, "recent")}>
          <SelectTrigger className="w-[11rem]" aria-label="Sort metrics">
            <ArrowDownWideNarrow className="size-4 text-muted-foreground" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="conversions">Most conversions</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={(value) => set("type", value, "all")}>
          <SelectTrigger className="w-[12rem]" aria-label="Filter by type">
            <Filter className="size-4 text-muted-foreground" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto shrink-0 text-sm text-muted-foreground tabular-nums">
          {total} {total === 1 ? "metric" : "metrics"}
        </span>
      </div>
    </div>
  );
}
