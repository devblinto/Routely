import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { ExperimentPreview } from "@/components/auth/experiment-preview";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { describeAuthError } from "@/lib/auth-errors";
import { AFTER_SIGN_IN } from "@/lib/routes";
import { signInWithGoogle } from "@/server/auth/actions";
import { getSession, isAuthConfigured } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in" };

/** Only same-site relative paths survive; see the matching guard in the sign-in action. */
function safeCallbackUrl(value: string | undefined): string {
  if (!value) return AFTER_SIGN_IN;
  return value.startsWith("/") && !value.startsWith("//") ? value : AFTER_SIGN_IN;
}

/**
 * Sign-in screen.
 *
 * Reading order is heading → action → reassurance. Anything conditional — an error, a setup
 * notice — is inserted above the button so it is read before the user acts rather than after.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  // Someone who is already signed in has no business on the login screen.
  if (session) {
    redirect(callbackUrl);
  }

  const configured = isAuthConfigured();
  const authError = describeAuthError(params.error);

  // Arriving with a callbackUrl means the visitor was stopped on the way somewhere.
  const wasRedirected = callbackUrl !== AFTER_SIGN_IN;

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in to Routely</h2>
        <p className="mx-auto max-w-[19rem] text-sm text-balance text-muted-foreground">
          {wasRedirected
            ? "Sign in to continue to the page you were opening."
            : "Manage your websites and redirect experiments."}
        </p>
      </header>

      <Card className="shadow-sm">
        <CardContent className="space-y-5">
          {authError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>{authError.title}</AlertTitle>
              <AlertDescription>{authError.description}</AlertDescription>
            </Alert>
          ) : null}

          {!configured ? (
            <Alert>
              <AlertTitle>Google sign-in is not configured</AlertTitle>
              <AlertDescription>
                Set <code className="font-mono text-xs">AUTH_SECRET</code>,{" "}
                <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code> and{" "}
                <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code> in{" "}
                <code className="font-mono text-xs">apps/web/.env</code>. To browse the dashboard
                without them, set <code className="font-mono text-xs">AUTH_DEV_BYPASS=true</code> —
                that flag is refused in production.
              </AlertDescription>
            </Alert>
          ) : null}

          <form action={signInWithGoogle}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <GoogleSignInButton disabled={!configured} />
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Routely has no passwords — Google handles the sign-in.
          </p>

          <div className="flex gap-2.5 border-t border-border/70 pt-5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" aria-hidden />
            <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
              We read only your name, email address and profile picture, and use them to identify
              your account. Routely never posts to your Google account.
            </p>
          </div>
        </CardContent>
      </Card>

      <ExperimentPreview />
    </div>
  );
}
