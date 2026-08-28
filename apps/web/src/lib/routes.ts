/**
 * Single source of truth for every URL in the dashboard.
 *
 * Building links through these helpers instead of hand-written template strings means a route
 * rename is one edit, and typos become type errors rather than 404s at runtime.
 */

export const routes = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  getStarted: "/get-started",

  websites: {
    new: "/websites/new",
    detail: (websiteId: string) => `/websites/${encodeURIComponent(websiteId)}`,
  },

  /** Public, token-addressed results page. Deliberately outside the protected prefixes. */
  share: (token: string) => `/share/${encodeURIComponent(token)}`,

  experiments: {
    new: (websiteId?: string) =>
      websiteId
        ? `/experiments/new?websiteId=${encodeURIComponent(websiteId)}`
        : "/experiments/new",
    detail: (experimentId: string) => `/experiments/${encodeURIComponent(experimentId)}`,
  },
} as const;

/** Route prefixes that require an authenticated session. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/get-started",
  "/websites",
  "/experiments",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
