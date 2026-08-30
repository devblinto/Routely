import { Check } from "lucide-react";

import { CodeBlock } from "@/components/common/code-block";
import { buildSnippet } from "@/lib/snippet";

/**
 * Requirements that hold on every platform, checked off after the snippet is placed. Exported
 * separately from `WordPressInstallGuide` because the website detail page renders these inside
 * its own "Check the placement" step, while the Get started guide appends them directly.
 */
export const PLACEMENT_RULES = [
  {
    rule: "Inside <head>, as early as possible",
    why: "The snippet decides whether to redirect before the page is painted.",
  },
  {
    rule: "No async or defer attribute",
    why: "Either one delays the decision until after visitors have seen the original page.",
  },
  {
    rule: "On the control, variant and conversion pages",
    why: "A conversion can only be attributed if the snippet is running when it happens.",
  },
] as const;

/** The three placement rules, rendered as a checklist. */
export function PlacementRules() {
  return (
    <ul className="space-y-2.5">
      {PLACEMENT_RULES.map(({ rule, why }) => (
        <li key={rule} className="flex gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">{rule}</span>
            <span className="block text-sm text-muted-foreground">{why}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const WORDPRESS_OPTIONS = [
  {
    title: "A header/footer plugin",
    body: (
      <>
        Survives theme updates. Install <em>WPCode</em> or <em>Insert Headers and Footers</em>, then
        paste the snippet into its <span className="font-medium text-foreground">Header</span> box.
      </>
    ),
  },
  {
    title: "Your theme’s options",
    body: (
      <>
        Many themes have a Custom Code, Header Scripts or Site-wide Scripts field under{" "}
        <span className="font-mono text-xs">Appearance</span> or in the customiser.
      </>
    ),
  },
  {
    title: "The theme files",
    body: (
      <>
        Edit <span className="font-mono text-xs">header.php</span> in a{" "}
        <span className="font-medium text-foreground">child theme</span> and paste it before{" "}
        <code className="font-mono text-xs">&lt;/head&gt;</code>. Editing a parent theme directly
        loses the change on the next update.
      </>
    ),
  },
] as const;

/**
 * WordPress-specific install instructions: the snippet and where to paste it. Shared between
 * the website detail page's full install panel and the Get started guide, which only offers
 * this one platform. Pair with `PlacementRules` for the checklist that applies everywhere.
 */
export function WordPressInstallGuide({
  sdkUrl,
  publicSiteId,
}: {
  sdkUrl: string;
  publicSiteId: string;
}) {
  const snippet = buildSnippet({ sdkUrl, publicSiteId });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This snippet is unique to this website and safe to publish — it contains no secret.
        </p>
        <CodeBlock code={snippet} label="Copy install snippet" />
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          WooCommerce is WordPress, so one installation covers your shop, checkout and thank-you
          pages. Use whichever of these you already have — they are listed safest first.
        </p>

        <ol className="space-y-3">
          {WORDPRESS_OPTIONS.map((option, index) => (
            <li key={option.title} className="flex gap-3 rounded-lg border border-border/70 p-3">
              <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{option.title}</p>
                <p className="text-sm text-muted-foreground">{option.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-sm text-muted-foreground">
          Caching and optimisation plugins often defer or combine scripts, which breaks the
          placement rules. If you use one, exclude this snippet from JavaScript optimisation.
        </p>
      </div>
    </div>
  );
}
