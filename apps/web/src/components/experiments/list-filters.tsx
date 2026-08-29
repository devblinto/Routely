"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Status tabs and name search for the experiments list.
 *
 * Both live in the URL so the view is bookmarkable and the server does the filtering — the
 * alternative, holding every experiment client-side and filtering there, gets slower exactly
 * as a customer accumulates tests.
 *
 * The search input is debounced: typing "checkout" would otherwise issue eight server round
 * trips, seven of which are thrown away.
 */

const DEBOUNCE_MS = 300;

export interface StatusTab {
  key: string;
  label: string;
  count: number;
}

export function ListFilters({
  tabs,
  status,
  search,
}: {
  tabs: StatusTab[];
  status: string;
  search: string;
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

  function selectStatus(key: string) {
    const params = new URLSearchParams(searchParams);
    if (key === "all") params.delete("status");
    else params.set("status", key);
    push(params);
  }

  // Debounced, and skipped entirely when the term already matches the URL — otherwise the
  // effect would fire a redundant navigation on every render caused by the navigation itself.
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav
        aria-label="Filter by status"
        className="flex w-full gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1 ring-1 ring-border/70 sm:w-auto"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => selectStatus(tab.key)}
            aria-current={tab.key === status ? "page" : undefined}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab.key === status
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">{tab.count}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="relative w-full sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search experiments…"
          aria-label="Search experiments by name"
          className="pl-8"
        />
        {isPending ? (
          <Loader2
            className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
