/**
 * Display formatting helpers.
 *
 * A fixed locale ("en-GB") and an explicit UTC time zone are used deliberately: these values
 * are rendered on the server, and letting the format depend on the server's locale or time
 * zone would make server and client markup disagree and produce a hydration mismatch.
 */

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** e.g. "28 Aug 2026" */
export function formatDate(value: Date): string {
  return DATE_FORMAT.format(value);
}

/** e.g. "28 Aug 2026, 06:12" — UTC, labelled as such wherever it is shown. */
export function formatDateTime(value: Date): string {
  return DATE_TIME_FORMAT.format(value);
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-GB");

/** e.g. "1,234" */
export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/**
 * A rate as a percentage, e.g. `0.0732` → "7.3%".
 *
 * One decimal place: the underlying counts are small enough at MVP volumes that a second
 * decimal would imply a precision the data does not have.
 */
export function formatPercent(fraction: number | null): string {
  if (fraction === null || !Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}

/**
 * A duration in milliseconds as something readable: "0.8s", "24s", "1m 05s", "1h 02m".
 *
 * Rounded deliberately coarsely — this is an approximate measurement (see docs/SDK-DEPLOYMENT.md),
 * and rendering it to the millisecond would suggest otherwise.
 */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";

  const seconds = ms / 1000;
  if (seconds < 1) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}
