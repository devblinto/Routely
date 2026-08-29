"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Field } from "@/components/common/field";
import { SubmitButton } from "@/components/common/submit-button";
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
import { Input } from "@/components/ui/input";
import {
  createWebsiteInlineAction,
  type CreateWebsiteInlineState,
} from "@/server/actions/website.actions";

const IDLE: CreateWebsiteInlineState = { status: "idle" };

const DEFAULT_TRIGGER = (
  <button
    type="button"
    className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Plus className="size-3.5" aria-hidden />
    Add another website
  </button>
);

/**
 * Website creation as a popup rather than a page — there is no standalone `/websites/new`
 * route. Uses `createWebsiteInlineAction` rather than `createWebsiteAction` because that one
 * redirects to the new website's own page on success, which would navigate away from wherever
 * this dialog was opened.
 *
 * Without an `onCreated` callback (the plain "add a website" case, e.g. an empty state) the
 * dialog falls back to `router.refresh()` so the server page re-renders with the new website
 * present. Callers that need the created row directly — the experiment wizard, which appends it
 * to a website picker without a round trip — pass `onCreated` instead.
 */
export function AddWebsiteDialog({
  onCreated,
  trigger = DEFAULT_TRIGGER,
}: {
  onCreated?: (website: { id: string; name: string; domain: string }) => void;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createWebsiteInlineAction, IDLE);

  // Render-time state adjustment (not an effect): react to the action's result the moment it
  // changes, without an extra effect-triggered render pass.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.status === "success" && state.website) {
      if (onCreated) {
        onCreated(state.website);
      } else {
        router.refresh();
      }
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a website</DialogTitle>
          <DialogDescription>
            A website groups your experiments and gives you one tracking snippet to install.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          {state.status === "error" && state.message ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Could not save</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <Field
            name="name"
            label="Name"
            hint="Only used to identify this website inside Routely."
            errors={state.fieldErrors?.["name"]}
          >
            {(props) => (
              <Input {...props} placeholder="Acme Store" maxLength={120} autoComplete="off" required />
            )}
          </Field>

          <Field
            name="domain"
            label="Domain"
            hint="The domain the tracking snippet will run on. Pasting a full URL is fine."
            errors={state.fieldErrors?.["domain"]}
          >
            {(props) => (
              <Input
                {...props}
                placeholder="acme.com"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            )}
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Adding…">Add website</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
