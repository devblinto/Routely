"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

/**
 * A region of the app's top bar that a page can render into.
 *
 * The top bar lives in `(app)/layout.tsx` and a page renders inside it, so a page cannot pass
 * anything upward the ordinary way — App Router layouts do not receive props from their
 * children, and they deliberately do not re-render on navigation.
 *
 * A tiny external store bridges the two. `useSyncExternalStore` is the sanctioned way to read
 * mutable state that lives outside React, and it keeps the publish side out of React's own
 * setState: `NavbarSlot` writes to a module variable in an effect — synchronising with an
 * external system, which is exactly what effects are for — rather than calling a parent's
 * setter, which would be a cascading render and is what the codebase's lint rules forbid.
 *
 * Deliberately single-occupancy: two pages are never mounted at once, so the last writer wins
 * and unmounting clears the bar. Anything more (a stack, keyed regions) would be machinery for
 * a case that cannot arise.
 */

let content: ReactNode = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReactNode {
  return content;
}

/** Nothing is ever in the bar during SSR: the page that fills it has not mounted yet. */
function getServerSnapshot(): ReactNode {
  return null;
}

/** Read by the app shell to render whatever the current page has published. */
export function useNavbarSlot(): ReactNode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Renders `children` into the top bar instead of in place.
 *
 * `children` is intentionally the whole dependency: the wizard hands over freshly-built markup
 * every time its step changes, and the bar has to follow it.
 */
export function NavbarSlot({ children }: { children: ReactNode }): null {
  useEffect(() => {
    content = children;
    emit();

    return () => {
      content = null;
      emit();
    };
  }, [children]);

  return null;
}
