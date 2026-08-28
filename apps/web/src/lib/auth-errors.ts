/**
 * Human-readable explanations for the error codes Auth.js puts in `?error=`.
 *
 * Auth.js codes are class names such as `OAuthAccountNotLinked`, which mean nothing to a
 * user. Each entry says what happened and what to do next; anything unrecognised falls back
 * to a generic message rather than being echoed to the page, since the query string is
 * attacker-controllable and must never be rendered verbatim.
 */

interface AuthErrorMessage {
  title: string;
  description: string;
}

const MESSAGES: Record<string, AuthErrorMessage> = {
  Configuration: {
    title: "Sign-in is not configured",
    description:
      "The server is missing its Google credentials. If you run this instance, check AUTH_SECRET, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  },
  AccessDenied: {
    title: "Access denied",
    description: "You cancelled the Google sign-in, or your account is not permitted to sign in.",
  },
  Verification: {
    title: "That link has expired",
    description: "Sign-in links can only be used once. Please try again.",
  },
  OAuthAccountNotLinked: {
    title: "That email is already in use",
    description:
      "An account already exists with this email address but was created with a different sign-in method. Use the original method to sign in.",
  },
  OAuthSignInError: {
    title: "Could not reach Google",
    description: "Sign-in could not be started. Please try again in a moment.",
  },
  OAuthCallbackError: {
    title: "Google sign-in did not complete",
    description:
      "The response from Google could not be verified. This usually resolves on a second attempt.",
  },
  CallbackRouteError: {
    title: "Sign-in did not complete",
    description: "Something went wrong while finishing sign-in. Please try again.",
  },
  SessionTokenError: {
    title: "Your session could not be read",
    description: "Please sign in again.",
  },
};

const FALLBACK: AuthErrorMessage = {
  title: "Sign-in failed",
  description: "Something went wrong while signing you in. Please try again.",
};

export function describeAuthError(code: string | undefined): AuthErrorMessage | null {
  if (!code) return null;
  return MESSAGES[code] ?? FALLBACK;
}
