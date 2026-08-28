"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";

import { Field } from "@/components/common/field";
import { SubmitButton } from "@/components/common/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { IDLE, type FormState } from "@/lib/form-state";

export interface WebsiteOption {
  id: string;
  name: string;
  domain: string;
}

/**
 * Create/edit form for a redirect experiment.
 *
 * One component serves both cases: the caller supplies the action, the existing values, and
 * whether the URLs may still be changed. Validation errors come back from the server through
 * `useActionState` rather than being duplicated client-side — the server's rules are the only
 * definition of what is valid, and two of them (the same-site rule and the active-conflict
 * rule) need data the browser does not have.
 */
export function ExperimentForm({
  action,
  websites,
  selectedWebsiteId,
  experimentId,
  defaults,
  urlsLocked = false,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Omitted when editing — the website is fixed and shown as context instead. */
  websites?: WebsiteOption[];
  selectedWebsiteId?: string;
  experimentId?: string;
  defaults?: {
    name?: string;
    description?: string;
    controlUrl?: string;
    variantUrl?: string;
    conversionUrl?: string;
  };
  /** True once the experiment has started: its targets are fixed from then on. */
  urlsLocked?: boolean;
  submitLabel: string;
  pendingLabel: string;
  cancelHref?: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const [websiteId, setWebsiteId] = useState(selectedWebsiteId ?? websites?.[0]?.id ?? "");

  const domain = websites?.find((website) => website.id === websiteId)?.domain;

  return (
    <form action={formAction} className="space-y-8">
      {experimentId ? <input type="hidden" name="experimentId" value={experimentId} /> : null}
      {websites ? <input type="hidden" name="websiteId" value={websiteId} /> : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "success" && state.message ? (
        <Alert role="status">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-5">
        {websites && websites.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Select value={websiteId} onValueChange={setWebsiteId}>
              <SelectTrigger id="website" className="w-full">
                <SelectValue placeholder="Choose a website" />
              </SelectTrigger>
              <SelectContent>
                {websites.map((website) => (
                  <SelectItem key={website.id} value={website.id}>
                    {website.name} — {website.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              All three URLs below must be on this website&rsquo;s domain.
            </p>
          </div>
        ) : null}

        <Field
          name="name"
          label="Experiment name"
          hint="Only used to identify this test inside Routely."
          errors={state.fieldErrors?.["name"]}
        >
          {(props) => (
            <Input
              {...props}
              defaultValue={defaults?.name}
              placeholder="Pricing page redesign"
              maxLength={120}
              autoComplete="off"
              required
            />
          )}
        </Field>

        <Field
          name="description"
          label="What are you testing?"
          hint="Optional. A sentence now saves guesswork when you read the results later."
          errors={state.fieldErrors?.["description"]}
        >
          {(props) => (
            <Textarea
              {...props}
              defaultValue={defaults?.description}
              placeholder="Does the rebuilt pricing page convert better than the original?"
              maxLength={500}
              rows={2}
            />
          )}
        </Field>
      </div>

      <fieldset disabled={urlsLocked} className="space-y-5 disabled:opacity-60">
        <legend className="sr-only">Pages to compare</legend>

        <div className="space-y-1">
          <h3 className="text-sm font-medium">Pages to compare</h3>
          <p className="text-sm text-muted-foreground">
            Traffic is split evenly: half of your visitors stay on the control, half are sent to the
            variant.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="controlUrl"
            label="Control URL"
            hint="The page visitors already land on. They stay here."
            errors={state.fieldErrors?.["controlUrl"]}
          >
            {(props) => (
              <Input
                {...props}
                defaultValue={defaults?.controlUrl}
                placeholder={domain ? `https://${domain}/pricing` : "https://example.com/pricing"}
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            )}
          </Field>

          <Field
            name="variantUrl"
            label="Variant URL"
            hint="The alternative page. Half your visitors are redirected here."
            errors={state.fieldErrors?.["variantUrl"]}
          >
            {(props) => (
              <Input
                {...props}
                defaultValue={defaults?.variantUrl}
                placeholder={
                  domain ? `https://${domain}/pricing-v2` : "https://example.com/pricing-v2"
                }
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            )}
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium ring-1 ring-border/70">
            50% control
          </span>
          <ArrowRight className="size-3" aria-hidden />
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium ring-1 ring-border/70">
            50% variant
          </span>
          <span>Fixed for now — uneven splits are not available yet.</span>
        </div>

        <Field
          name="conversionUrl"
          label="Conversion URL"
          hint="Reaching this page counts as a conversion for whichever version the visitor saw. The snippet must be installed here too."
          errors={state.fieldErrors?.["conversionUrl"]}
        >
          {(props) => (
            <Input
              {...props}
              defaultValue={defaults?.conversionUrl}
              placeholder={domain ? `https://${domain}/thank-you` : "https://example.com/thank-you"}
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          )}
        </Field>
      </fieldset>

      {urlsLocked ? (
        <Alert>
          <Target aria-hidden />
          <AlertTitle>This experiment has already started</AlertTitle>
          <AlertDescription>
            Its URLs are fixed. Visitors are already assigned against the current configuration, so
            changing the pages now would mix two different tests into one set of results. Archive it
            and create a new experiment to test different pages.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
        {cancelHref ? (
          <Button variant="ghost" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
