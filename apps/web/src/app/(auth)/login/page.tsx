import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { ExperimentPreview } from "@/components/auth/experiment-preview";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
 *
 * The form sits directly on the column rather than inside a card: with the showcase panel
 * beside it the split already separates the two halves, and a card inside a panel is a border
 * drawn around a border.
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
    <div className="space-y-8">
      <header className="space-y-2">
        {/* Not "Welcome back": with Google as the only method, signing in is also how an
            account is created, so a first-time visitor sees this heading too. */}
        <h1 className="text-3xl font-semibold tracking-tight">Sign in to Routely</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {wasRedirected
            ? "Sign in to continue to the page you were opening."
            : "Manage your websites and redirect experiments."}
        </p>
      </header>

      <div className="space-y-4">
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

        <p className="text-sm text-muted-foreground">
          New to Routely? Signing in with Google creates your account — there is no separate
          sign-up, and no password to choose.
        </p>
      </div>

      <div className="flex gap-2.5 border-t border-border/70 pt-6">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" aria-hidden />
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
          We read only your name, email address and profile picture, and use them to identify your
          account. Routely never posts to your Google account.
        </p>
      </div>

      {/* The showcase panel carries this on wide screens; below `lg` it is not rendered, so the
          compact version stands in rather than leaving the question unanswered. */}
      <ExperimentPreview className="lg:hidden" />
    </div>
  );
}
