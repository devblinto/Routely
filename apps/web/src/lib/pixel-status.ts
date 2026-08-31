/**
 * What we know about a website's tracking, as three ordered states.
 *
 * Two independent signals, answering different questions — which is why one boolean could not
 * express it, and why a single boolean produced a Get started guide that said "You're all set"
 * beside a website list that said "Pixel not detected", both truthfully.
 *
 *  - **Data arriving** proves the snippet works, end to end.
 *  - **Verification** proves it was on the page when we last fetched it.
 *
 * Neither implies the other. A correctly installed site with no running experiment sends
 * nothing, because the SDK only reports once an active experiment matches a page being viewed.
 * And a site that reported last month may have had the snippet removed since.
 *
 * This module has no imports on purpose: it is shared by server code and client components, so
 * the labels beside a status cannot drift from the status itself.
 */

export type PixelStatus =
  /** Events have arrived. The strongest evidence, so it outranks a stale verification. */
  | "receiving"
  /** The snippet was confirmed on a page, but nothing has reported yet — normal before a test. */
  | "connected"
  /** Neither has happened. */
  | "unknown";

/**
 * Data first, then verification.
 *
 * Ordered by how much each fact proves *now*: an event arrived through the real ingestion path,
 * whereas a verification records only what a fetch saw at some earlier moment.
 */
export function resolvePixelStatus(
  receivingData: boolean,
  pixelVerifiedAt: Date | null,
): PixelStatus {
  if (receivingData) return "receiving";
  if (pixelVerifiedAt) return "connected";
  return "unknown";
}

export interface PixelStatusPresentation {
  label: string;
  hint: string;
  /** Whether to read as good news. Drives colour and icon at each call site. */
  positive: boolean;
}

/**
 * One place deciding what each state is called.
 *
 * "Connected" rather than "Installed": we observed the snippet on a page at a point in time,
 * which is a weaker claim than asserting it is installed everywhere, and the hint says when.
 */
export const PIXEL_STATUS: Record<PixelStatus, PixelStatusPresentation> = {
  receiving: {
    label: "Receiving data",
    hint: "Tracking data is arriving",
    positive: true,
  },
  connected: {
    label: "Connected",
    hint: "Snippet confirmed — data arrives once an experiment is running",
    positive: true,
  },
  unknown: {
    label: "Not connected",
    hint: "Install the snippet and verify it to finish setup",
    positive: false,
  },
};
