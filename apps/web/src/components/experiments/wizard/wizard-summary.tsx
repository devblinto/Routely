"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";

import { WizardStepCard } from "@/components/experiments/wizard/wizard-step-card";
import {
  PRIMARY_METRIC_LABEL,
  type WizardActiveExperiment,
  type WizardValues,
  type WizardWebsite,
} from "@/components/experiments/wizard/wizard-types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormState } from "@/lib/form-state";
import { armShares } from "@/lib/traffic";
import { controlUrlsConflict, isSameSite, isSameUrl, normalizeUrl } from "@/lib/url";
import { cn } from "@/lib/utils";
import { checkInstallOnPageAction, type InstallCheckResult } from "@/server/actions/pixel.actions";

interface CheckResult {
  key: string;
  label: string;
  detail: string;
  status: "pass" | "warn" | "fail" | "pending";
}

/** The install check's lifecycle, kept separate from the rules computed synchronously. */
type InstallState =
  { phase: "idle" } | { phase: "checking" } | { phase: "done"; result: InstallCheckResult };

/**
 * The pre-publish checklist, computed entirely client-side from values already on screen plus
 * context the page loaded up front (the actor's other active experiments). These mirror real
 * server-side rules — the same-site rule, the active-conflict rule, the URL-distinctness rule.
 *
 * The same-site rule is deliberately a warning here, not a blocking failure: unlike the other
 * two, `createExperimentAction` is the actual, unweakened enforcement of it (`assertSameSite` in
 * experiment.service.ts) — this client-side copy is only a heads-up while iterating on the
 * form, not a second gate, so it doesn't block "Acknowledge & create" for now.
 *
 * Script installation is deliberately not checked here for now — a draft doesn't need the pixel
 * verified yet, and re-adding that check later just means passing `pixelDetected` back in.
 */
function buildChecks(
  values: WizardValues,
  website: WizardWebsite | undefined,
  activeExperiments: WizardActiveExperiment[],
): CheckResult[] {
  const domain = website?.domain ?? "";

  const sameSite =
    website !== undefined &&
    isSameSite(values.controlUrl, domain) &&
    isSameSite(values.conversionUrl, domain) &&
    values.variants.every((variant) => isSameSite(variant.url, domain));

  const conflict = activeExperiments.find(
    (experiment) =>
      experiment.websiteId === values.websiteId &&
      controlUrlsConflict(
        { url: values.controlUrl, match: values.controlMatchType },
        { url: experiment.controlUrl, match: experiment.controlMatchType },
      ),
  );

  const allUrls = [
    values.controlUrl,
    ...values.variants.map((variant) => variant.url),
    values.conversionUrl,
  ];

  // Blank or unparseable URLs are separated out first, because they cannot take part in a
  // comparison: `isSameUrl` is false even against itself for those, so including them in the
  // duplicate scan below reported "two pages share a URL" for a form that was merely unfinished.
  const usableUrls = allUrls.filter((url) => normalizeUrl(url) !== null);
  const incomplete = usableUrls.length !== allUrls.length;

  // Every pair among control, every variant, and the goal must be distinct — two variants
  // sharing a URL is the same mistake between two arms instead of one.
  const distinct = usableUrls.every(
    (url, index) => usableUrls.findIndex((other) => isSameUrl(other, url)) === index,
  );

  return [
    {
      key: "same-site",
      label: "Same-site rule",
      status: sameSite ? "pass" : "warn",
      detail: sameSite
        ? `Every URL is on ${domain}.`
        : `Every URL must be on ${domain || "the website's domain"} or one of its subdomains — creating this will be rejected server-side until they are.`,
    },
    {
      key: "conflict",
      label: "No active conflict",
      status: conflict ? "fail" : "pass",
      detail: conflict
        ? `"${conflict.name}" is already active on this control URL. Pause or archive it first.`
        : "No other active experiment targets this control URL.",
    },
    {
      key: "variant-configuration",
      label: "Variant configuration",
      status: incomplete || !distinct ? "fail" : "pass",
      // Two different problems, so two different messages — telling someone with a half-filled
      // form that "no two can share a URL" sends them looking for a duplicate that isn't there.
      detail: incomplete
        ? "Every URL needs to be filled in, and each must be a full address including https://."
        : distinct
          ? "Control, every variant, and the goal are all distinct pages."
          : "Control, every variant, and the goal must all be different pages — no two can share a URL.",
    },
  ];
}

/**
 * The install check as a checklist row.
 *
 * Always a warning at worst, never a failure: an experiment is created as a draft, and a draft
 * with no snippet yet is a perfectly reasonable thing to have. It also cannot be proven
 * negative — a snippet injected by a tag manager runs in a browser but is invisible to a
 * server-side fetch of the raw HTML.
 */
function installCheck(state: InstallState, controlUrl: string): CheckResult {
  const base = { key: "install", label: "Script installation" };

  if (state.phase === "checking") {
    return {
      ...base,
      status: "pending",
      detail: `Loading ${controlUrl} to look for your snippet…`,
    };
  }

  if (state.phase === "idle") {
    return {
      ...base,
      status: "warn",
      detail: "Not checked — enter a valid control URL and reopen this dialog to check it.",
    };
  }

  if (!state.result.ok) {
    return { ...base, status: "warn", detail: state.result.message };
  }

  if (state.result.snippetFound) {
    return { ...base, status: "pass", detail: "The snippet is on your control page." };
  }

  return {
    ...base,
    status: "warn",
    detail: state.result.wrongSiteId
      ? "That page has a Routely snippet, but for a different website. It won't record anything for this experiment."
      : "We loaded your control page but couldn't find the snippet. You can still create this as a draft and install it before activating.",
  };
}

function CheckRow({ check }: { check: CheckResult }) {
  const Icon =
    check.status === "pass"
      ? Check
      : check.status === "pending"
        ? Loader2
        : check.status === "warn"
          ? AlertTriangle
          : X;

  return (
    <li className="flex gap-3 py-3">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
          check.status === "pass"
            ? "bg-primary/10 text-primary"
            : check.status === "pending"
              ? "bg-muted text-muted-foreground"
              : check.status === "warn"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className={cn("size-3.5", check.status === "pending" && "animate-spin")} />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="text-sm text-pretty text-muted-foreground">{check.detail}</p>
      </div>
    </li>
  );
}

export function SummaryStep({
  values,
  website,
  activeExperiments,
  formId,
  isPending,
  state,
  dialogOpen,
  onDialogOpenChange,
  onBack,
}: {
  values: WizardValues;
  website: WizardWebsite | undefined;
  activeExperiments: WizardActiveExperiment[];
  formId: string;
  isPending: boolean;
  state: FormState;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onBack: () => void;
}) {
  const [install, setInstall] = useState<InstallState>({ phase: "idle" });

  /**
   * Runs when the dialog opens — from the event handler rather than an effect, so opening is
   * what triggers the request rather than a render reacting to state that already changed.
   * Re-checked on every open, since the control URL may have been edited in between.
   */
  async function handleOpenChange(open: boolean) {
    onDialogOpenChange(open);
    if (!open) return;

    // Nothing to fetch until the control URL is a real address; `installCheck` explains the
    // idle state rather than reporting a failure the customer cannot act on.
    if (!website || normalizeUrl(values.controlUrl) === null) {
      setInstall({ phase: "idle" });
      return;
    }

    setInstall({ phase: "checking" });
    const result = await checkInstallOnPageAction({
      websiteId: website.id,
      url: values.controlUrl,
    });
    setInstall({ phase: "done", result });
  }

  const checks = [
    ...buildChecks(values, website, activeExperiments),
    installCheck(install, values.controlUrl),
  ];
  const hasFailure = checks.some((check) => check.status === "fail");

  const shares = armShares({
    controlWeight: values.controlWeight,
    variantWeights: values.variants.map((variant) => variant.weight),
    trafficAllocation: values.trafficAllocation,
  });

  return (
    <WizardStepCard
      title="Summary"
      description="Review everything below, then run the pre-publish check before creating this experiment."
      footer={
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>

          <Dialog open={dialogOpen} onOpenChange={(open) => void handleOpenChange(open)}>
            <DialogTrigger asChild>
              <Button type="button">Review &amp; create</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Pre-publish check</DialogTitle>
                <DialogDescription>
                  {hasFailure
                    ? "Fix the issues below before creating this experiment."
                    : "Everything checks out — warnings below won't block creating a draft."}
                </DialogDescription>
              </DialogHeader>

              {state.status === "error" && state.message ? (
                <Alert variant="destructive" role="alert">
                  <AlertTitle>Could not create the experiment</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              ) : null}

              <ul className="divide-y divide-border/70 border-t border-border/70">
                {checks.map((check) => (
                  <CheckRow key={check.key} check={check} />
                ))}
              </ul>

              <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
                <Button type="button" variant="ghost" onClick={() => onDialogOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" form={formId} disabled={hasFailure || isPending}>
                  {isPending ? "Creating…" : "Acknowledge & create"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Website</dt>
          <dd className="mt-0.5">{website ? `${website.name} — ${website.domain}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Experiment name</dt>
          <dd className="mt-0.5">{values.name || "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Control URL</dt>
          <dd className="mt-0.5 truncate font-mono text-xs" title={values.controlUrl}>
            {values.controlUrl || "—"}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">
            {values.variants.length === 1 ? "Variant URL" : "Variant URLs"}
          </dt>
          <dd className="mt-0.5 space-y-0.5">
            {values.variants.map((variant, index) => (
              <p
                key={variant.id ?? index}
                className="truncate font-mono text-xs"
                title={variant.url}
              >
                {values.variants.length > 1 ? `${index + 1}. ` : ""}
                {variant.url || "—"}
              </p>
            ))}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">Conversion URL</dt>
          <dd className="mt-0.5 truncate font-mono text-xs" title={values.conversionUrl}>
            {values.conversionUrl || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Goal type</dt>
          <dd className="mt-0.5">Pageview</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Primary metric</dt>
          <dd className="mt-0.5">{PRIMARY_METRIC_LABEL[values.primaryMetric]}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Audience</dt>
          <dd className="mt-0.5">All visitors</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Traffic included</dt>
          <dd className="mt-0.5">{values.trafficAllocation}% of visitors</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Split</dt>
          <dd className="mt-0.5">
            {[shares.control, ...shares.variants].map((share) => `${share}%`).join(" / ")}
          </dd>
        </div>
      </dl>
    </WizardStepCard>
  );
}
