"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

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
import { routes } from "@/lib/routes";
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
  initialPixelDetected,
}: {
  website: { id: string; name: string; domain: string; publicSiteId: string };
  sdkUrl: string;
  verifyAction: (state: FormState, formData: FormData) => Promise<FormState>;
  initialPixelDetected: boolean;
}) {
  const [step, setStep] = useState<StepKey>(initialPixelDetected ? "done" : "install");

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
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Setup guide" className="flex gap-2 lg:flex-col lg:gap-1">
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
                "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors lg:flex-none",
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

      <Card>
        {step === "install" ? (
          <>
            <CardHeader>
              <CardTitle>Install the tracking pixel</CardTitle>
              <CardDescription>
                Routely only ships a WordPress install today — every other platform below is
                on the way.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PlatformGrid />
              <div className="space-y-6 border-t border-border/70 pt-6">
                <WordPressInstallGuide sdkUrl={sdkUrl} publicSiteId={website.publicSiteId} />
                <PlacementRules />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep("verify")}>Continue</Button>
              </div>
            </CardContent>
          </>
        ) : null}

        {step === "verify" ? (
          <>
            <CardHeader>
              <CardTitle>Verify your installation</CardTitle>
              <CardDescription>
                We&apos;ll check whether {website.domain} has sent any tracking data yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form action={formAction} className="space-y-5">
                <input type="hidden" name="websiteId" value={website.id} />

                {state.status === "error" && state.message ? (
                  <Alert variant="destructive" role="alert">
                    <AlertTitle>Pixel not detected</AlertTitle>
                    <AlertDescription>{state.message}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="verify-domain">Website</Label>
                  <Input
                    id="verify-domain"
                    readOnly
                    value={`https://${website.domain}`}
                    className="text-muted-foreground"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <SubmitButton pendingLabel="Verifying…">Verify installation</SubmitButton>
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
                {website.name} is receiving tracking data. Create an experiment whenever
                you&apos;re ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={routes.experiments.new(website.id)}>Create an experiment</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={routes.dashboard}>Go to dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </>
        ) : null}
      </Card>
    </div>
  );
}
