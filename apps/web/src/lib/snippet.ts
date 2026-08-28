/**
 * Install snippet generation.
 *
 * There is exactly **one snippet per website**, never one per experiment. The snippet carries
 * the website's public site id; which experiments are running on that website is resolved by
 * the SDK at runtime. Creating, activating, pausing or deleting an experiment therefore never
 * requires the customer to touch their site again — which is the whole point of installing a
 * tag rather than editing pages.
 *
 * The snippet contains no secret. The public site id is an identifier that appears in page
 * source by design; it permits appending events to one website and nothing else.
 */

/** Escapes a value for safe interpolation into an HTML attribute in generated markup. */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface SnippetOptions {
  sdkUrl: string;
  publicSiteId: string;
}

/**
 * The canonical snippet.
 *
 * Loaded synchronously — no `async`, no `defer` — and placed in `<head>`, so the redirect
 * decision happens before the browser paints the control page. That ordering is the reason
 * the installation instructions insist on `<head>` rather than treating it as a preference.
 */
export function buildSnippet({ sdkUrl, publicSiteId }: SnippetOptions): string {
  return `<script src="${escapeAttribute(sdkUrl)}" data-site-id="${escapeAttribute(publicSiteId)}"></script>`;
}

/** The same snippet as a Next.js `<Script>` element, for App Router root layouts. */
export function buildNextSnippet({ sdkUrl, publicSiteId }: SnippetOptions): string {
  return `import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="${sdkUrl}"
          data-site-id="${publicSiteId}"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}`;
}
