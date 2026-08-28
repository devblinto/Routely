import { Check } from "lucide-react";

import { CodeBlock } from "@/components/common/code-block";
import { Step } from "@/components/common/step";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildNextSnippet, buildSnippet } from "@/lib/snippet";

/**
 * The install panel on a website's detail page.
 *
 * Structured as three numbered steps — copy, place, check — because installing a tag is a
 * task with an order, and a flat wall of code blocks and callouts made the reader work out
 * that order themselves.
 *
 * One snippet, shown once, for the whole website. The per-platform tabs differ only in
 * *where* the same tag goes, never in what it contains: a different snippet per framework
 * would imply the tag is framework-specific, and one per experiment would imply the customer
 * has to re-install as they run more tests.
 */

/** Requirements that hold on every platform, checked off in the final step. */
const PLACEMENT_RULES = [
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

export function InstallSnippet({
  sdkUrl,
  publicSiteId,
  domain,
}: {
  sdkUrl: string;
  publicSiteId: string;
  domain: string;
}) {
  const snippet = buildSnippet({ sdkUrl, publicSiteId });
  const nextSnippet = buildNextSnippet({ sdkUrl, publicSiteId });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Install the tracking snippet</CardTitle>
          <Badge variant="secondary">One-time setup</Badge>
        </div>
        <CardDescription>
          Add this once to every page of <span className="font-medium">{domain}</span>. Every
          experiment on this website uses the same snippet, so you never need to come back here when
          you add or change a test.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ol className="list-none">
          <Step
            number={1}
            title="Copy your snippet"
            description="This is unique to this website and safe to publish."
          >
            <CodeBlock code={snippet} label="Copy install snippet" />
            <p className="text-xs text-muted-foreground">
              Contains no secret. <code className="font-mono">{publicSiteId}</code> is a public
              identifier — it is meant to be visible in your page source, and it only permits
              recording visits to this website.
            </p>
          </Step>

          <Step
            number={2}
            title="Add it to your site"
            description="The snippet is the same everywhere; only its location differs."
          >
            <Tabs defaultValue="html">
              <TabsList>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="wordpress">WordPress</TabsTrigger>
                <TabsTrigger value="react">React / Next.js</TabsTrigger>
              </TabsList>

              <TabsContent value="html" className="space-y-3 pt-4">
                <p className="text-sm text-muted-foreground">
                  Paste it inside <code className="font-mono text-xs">&lt;head&gt;</code>, before
                  any other script. If your pages come from a shared template or layout include, add
                  it there once rather than to each page.
                </p>
                <CodeBlock
                  code={`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    ${snippet}
    <title>Your page</title>
  </head>
  <body>
    …
  </body>
</html>`}
                  label="Copy HTML example"
                />
              </TabsContent>

              <TabsContent value="wordpress" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  WooCommerce is WordPress, so one installation covers your shop, checkout and
                  thank-you pages. Use whichever of these you already have — they are listed safest
                  first.
                </p>

                <ol className="space-y-3">
                  {[
                    {
                      title: "A header/footer plugin",
                      body: (
                        <>
                          Survives theme updates. Install <em>WPCode</em> or{" "}
                          <em>Insert Headers and Footers</em>, then paste the snippet into its{" "}
                          <span className="font-medium text-foreground">Header</span> box.
                        </>
                      ),
                    },
                    {
                      title: "Your theme’s options",
                      body: (
                        <>
                          Many themes have a Custom Code, Header Scripts or Site-wide Scripts field
                          under <span className="font-mono text-xs">Appearance</span> or in the
                          customiser.
                        </>
                      ),
                    },
                    {
                      title: "The theme files",
                      body: (
                        <>
                          Edit <span className="font-mono text-xs">header.php</span> in a{" "}
                          <span className="font-medium text-foreground">child theme</span> and paste
                          it before <code className="font-mono text-xs">&lt;/head&gt;</code>.
                          Editing a parent theme directly loses the change on the next update.
                        </>
                      ),
                    },
                  ].map((option, index) => (
                    <li
                      key={option.title}
                      className="flex gap-3 rounded-lg border border-border/70 p-3"
                    >
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
                  placement rules below. If you use one, exclude this snippet from JavaScript
                  optimisation.
                </p>
              </TabsContent>

              <TabsContent value="react" className="space-y-4 pt-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Next.js (App Router)</span> — add
                    it to your root layout with{" "}
                    <code className="font-mono text-xs">next/script</code>. The{" "}
                    <code className="font-mono text-xs">beforeInteractive</code> strategy loads it
                    early enough, and is only honoured in the root layout.
                  </p>
                  <CodeBlock code={nextSnippet} label="Copy Next.js example" />
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      React (Vite, CRA) and other single-page apps
                    </span>{" "}
                    — put the plain tag in the <code className="font-mono text-xs">index.html</code>{" "}
                    your app mounts into, not inside a component. A component renders after the app
                    has booted, which is too late to prevent a flash of the original page.
                  </p>
                  <CodeBlock code={snippet} label="Copy snippet for index.html" />
                </div>

                <p className="text-sm text-muted-foreground">
                  Client-side routing is handled for you — the SDK watches history changes, so
                  reaching your conversion page without a full reload is still counted.
                </p>
              </TabsContent>
            </Tabs>
          </Step>

          <Step
            number={3}
            title="Check the placement"
            description="These three rules apply on every platform."
            last
          >
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

            <p className="border-t border-border/70 pt-4 text-sm text-pretty text-muted-foreground">
              <span className="font-medium text-foreground">
                The snippet is framework-independent.
              </span>{" "}
              It is plain JavaScript with no dependencies and no build step, so it behaves the same
              on WordPress, WooCommerce, Shopify, React, Next.js, Vue, Rails or static HTML. There
              is nothing to install from npm and nothing to configure per framework.
            </p>
          </Step>
        </ol>
      </CardContent>
    </Card>
  );
}
