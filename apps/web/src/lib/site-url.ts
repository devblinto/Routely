import type { SiteProtocol } from "@/generated/prisma/enums";

/**
 * Building URLs for a website from its stored scheme and hostname.
 *
 * `Website.domain` is a bare hostname, so every screen that suggests a URL — the install
 * check's "page to check", the experiment wizard's URL placeholders — needs the scheme from
 * somewhere. Reading it from one helper keeps them from disagreeing, and stops `https://`
 * being hard-coded against a site that is served over http.
 */

export function siteScheme(protocol: SiteProtocol): "https://" | "http://" {
  return protocol === "HTTP" ? "http://" : "https://";
}

/** The site's origin, e.g. `https://acme.com` — no trailing slash. */
export function siteOrigin(site: { domain: string; protocol: SiteProtocol }): string {
  return `${siteScheme(site.protocol)}${site.domain}`;
}

/** An absolute URL on the site. `path` should start with `/`. */
export function siteUrl(site: { domain: string; protocol: SiteProtocol }, path = "/"): string {
  return `${siteOrigin(site)}${path}`;
}
