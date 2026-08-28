"use client";

import { useActionState } from "react";
import { Link2, Loader2, RefreshCw, X } from "lucide-react";

import { CopyValue } from "@/components/websites/copy-value";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IDLE, type FormState } from "@/lib/form-state";

/**
 * Controls for the public results link.
 *
 * The three actions are kept distinct because they answer different questions: create one,
 * "this link got out, give me a new one", and "stop sharing entirely". Collapsing rotate and
 * disable into a single toggle would make the first case require two steps and a moment where
 * nothing is shared.
 */
export function SharePanel({
  experimentId,
  shareUrl,
  enable,
  rotate,
  disable,
}: {
  experimentId: string;
  /** The full public URL, or null when sharing is off. */
  shareUrl: string | null;
  enable: (state: FormState, formData: FormData) => Promise<FormState>;
  rotate: (state: FormState, formData: FormData) => Promise<FormState>;
  disable: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [enableState, enableAction, enabling] = useActionState(enable, IDLE);
  const [rotateState, rotateAction, rotating] = useActionState(rotate, IDLE);
  const [disableState, disableAction, disabling] = useActionState(disable, IDLE);

  const state = [rotateState, disableState, enableState].find((s) => s.status !== "idle");
  const busy = enabling || rotating || disabling;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share results</CardTitle>
        <CardDescription>
          Create a read-only link so someone can see this experiment&rsquo;s numbers without a
          Routely account. It shows only this experiment — not your other tests, websites or
          account.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {state?.message ? (
          <Alert variant={state.status === "error" ? "destructive" : "default"} role="status">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {shareUrl ? (
          <>
            <CopyValue value={shareUrl} label="Copy share link" />
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view the results. It is unguessable, but it is not a
              password — treat it as public once you have sent it.
            </p>

            <div className="flex flex-wrap gap-2">
              <form action={rotateAction}>
                <input type="hidden" name="experimentId" value={experimentId} />
                <Button type="submit" variant="outline" size="sm" disabled={busy}>
                  {rotating ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw aria-hidden />
                  )}
                  Replace link
                </Button>
              </form>

              <form action={disableAction}>
                <input type="hidden" name="experimentId" value={experimentId} />
                <Button type="submit" variant="ghost" size="sm" disabled={busy}>
                  {disabling ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
                  Stop sharing
                </Button>
              </form>
            </div>
          </>
        ) : (
          <form action={enableAction}>
            <input type="hidden" name="experimentId" value={experimentId} />
            <Button type="submit" disabled={busy}>
              {enabling ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
              Create share link
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
