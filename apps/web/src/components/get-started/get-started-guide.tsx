"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";

import { PlatformGrid } from "@/components/get-started/platform-grid";
import { SubmitButton } from "@/components/common/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlacementRules,
  WordPressInstallGuide,
} from "@/components/websites/wordpress-install-guide";
import { IDLE, type FormState } from "@/lib/form-state";
import type { SiteProtocol } from "@/generated/prisma/enums";
import { siteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

type StepKey = "install" | "verify" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "install", label: "Install pixel" },
  { key: "verify", label: "Verify" },
  { key: "done", label: "All set" },
];

/**
 * The Get started guide: install the pixel, verify it fired, done.
 *
 * Progress is local component state, not anything persisted — "pixel detected" is the one
 * fact that outlives the page (derived from events, elsewhere), so there is nothing else here
 * worth saving. Landing back on this page after the pixel is already detected starts on the
 * last step rather than making the customer click through steps that are already satisfied.
 */
export function GetStartedGuide({
  website,
  sdkUrl,
  verifyAction,
  startOnDone,
  onDone,
}: {
  website: {
    id: string;
    name: string;
    domain: string;
    protocol: SiteProtocol;
    publicSiteId: string;
  };
  sdkUrl: string;
  verifyAction: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Open straight on the final step, for a website already known to be set up. */
  startOnDone: boolean;
  /** Dismisses the guide. The caller decides what that means — closing its dialog, here. */
  onDone: () => void;
}) {
  const [step, setStep] = useState<StepKey>(startOnDone ? "done" : "install");
  // Nothing is chosen by default — the WordPress instructions only appear once it is clicked.
  const [platformSelected, setPlatformSelected] = useState(false);

  // Wrapping the action lets the guide advance to "done" the moment verification succeeds,
  // without a useEffect watching the result — the transition belongs with the action that
  // causes it, not as a reaction to a state change after the fact.
  async function verifyAndAdvance(previous: FormState, formData: FormData): Promise<FormState> {
    const result = await verifyAction(previous, formData);
    if (result.status === "success") {
      setStep("done");
    }
    return result;
  }

  const [state, formAction] = useActionState(verifyAndAdvance, IDLE);

  const stepIndex = STEPS.findIndex((item) => item.key === step);

  return (
    <div className="flex h-full flex-col gap-6 overflow-hidden lg:flex-row">
      <nav
        aria-label="Setup guide"
        className="flex shrink-0 gap-2 lg:w-[220px] lg:flex-col lg:gap-1"
      >
        {STEPS.map((item, index) => {
          const completed = index < stepIndex;
          const current = index === stepIndex;
          const reachable = index <= stepIndex;

          return (
            <button
              key={item.key}
              type="button"
              disabled={!reachable}
              onClick={() => setStep(item.key)}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors lg:flex-none",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                current
                  ? "bg-muted text-foreground"
                  : completed
                    ? "text-foreground hover:bg-muted/60"
                    : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1",
                  completed
                    ? "bg-primary text-primary-foreground ring-primary"
                    : current
                      ? "ring-foreground/60"
                      : "ring-border",
                )}
              >
                {completed ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <Card className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {step === "install" ? (
          <>
            <CardHeader>
              <CardTitle>
                {platformSelected ? "Install on WordPress" : "Install the tracking pixel"}
              </CardTitle>
              <CardDescription>
                {platformSelected
                  ? "Paste this snippet into your site, then follow the placement rules below."
                  : "Routely only ships a WordPress install today — every other platform below is on the way. Pick one to see its steps."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {platformSelected ? (
                <div className="space-y-6">
                  <button
                    type="button"
                    onClick={() => setPlatformSelected(false)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowLeft className="size-3.5" aria-hidden />
                    Back to platforms
                  </button>
                  <WordPressInstallGuide sdkUrl={sdkUrl} publicSiteId={website.publicSiteId} />
                  <PlacementRules />
                </div>
              ) : (
                <PlatformGrid
                  selected={platformSelected}
                  onSelect={() => setPlatformSelected(true)}
                />
              )}
              <div className="flex justify-end">
                <Button disabled={!platformSelected} onClick={() => setStep("verify")}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </>
        ) : null}

        {step === "verify" ? (
          <>
            <CardHeader>
              <CardTitle>Verify your installation</CardTitle>
              <CardDescription>
                Enter a page on {website.domain} and we&apos;ll load it to confirm the snippet is
                there.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form action={formAction} className="space-y-5">
                <input type="hidden" name="websiteId" value={website.id} />

                {state.status === "error" && state.message ? (
                  <Alert variant="destructive" role="alert">
                    <AlertTitle>Snippet not found</AlertTitle>
                    <AlertDescription>{state.message}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="verify-url">Page to check</Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="verify-url"
                      name="url"
                      defaultValue={siteUrl(website)}
                      placeholder={siteUrl(website)}
                      inputMode="url"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      className="min-w-0 flex-1"
                    />
                    <SubmitButton pendingLabel="Checking…">Verify installation</SubmitButton>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Any page on {website.domain} that has the snippet. We load it and look for your
                    site id in the HTML.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={() => setStep("install")}>
                    Back
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-4" aria-hidden />
                </span>
                <CardTitle>You&apos;re all set</CardTitle>
              </div>
              <CardDescription>
                The snippet is live on {website.name}. It starts recording as soon as an experiment
                is running on a page it covers — create one whenever you&apos;re ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* One way out, rather than two onward journeys. Someone who just finished setup
                  wants to see it took effect; sending them straight into the experiment form
                  skips the confirmation they came for. */}
              <Button onClick={onDone}>Done</Button>
            </CardContent>
          </>
        ) : null}
      </Card>
    </div>
  );
}
