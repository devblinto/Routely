import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CLOAK_MS,
  applyCloak,
  clampCloakMs,
  cloakCss,
  sanitizeBackground,
} from "../src/cloak";

/**
 * A minimal stand-in for the parts of the DOM the cloak touches.
 *
 * The SDK's suites run in Node without a DOM, and the cloak is small enough that a fake keeps
 * the tests honest about exactly which APIs it depends on — appending a style element and
 * removing it again. Anything beyond that would not compile against this fake, which is the
 * point.
 */
function fakeDocument(overrides: Partial<Record<string, unknown>> = {}) {
  const children: FakeElement[] = [];

  interface FakeElement {
    id: string;
    text: string;
    parentNode: { removeChild(child: FakeElement): void } | null;
    appendChild(node: { text: string }): void;
  }

  const head = {
    appendChild(node: FakeElement) {
      node.parentNode = {
        removeChild(child: FakeElement) {
          const index = children.indexOf(child);
          if (index >= 0) children.splice(index, 1);
          child.parentNode = null;
        },
      };
      children.push(node);
    },
  };

  const doc = {
    head,
    children,
    createElement(): FakeElement {
      return {
        id: "",
        text: "",
        parentNode: null,
        appendChild(node: { text: string }) {
          this.text += node.text;
        },
      };
    },
    createTextNode(text: string) {
      return { text };
    },
    getElementById(id: string) {
      return children.find((child) => child.id === id) ?? null;
    },
    getElementsByTagName: () => [head],
    ...overrides,
  };

  return doc;
}

const asDocument = (doc: unknown) => doc as unknown as Document;

describe("sanitizeBackground", () => {
  it("defaults to white when unset or blank", () => {
    expect(sanitizeBackground(undefined)).toBe("#fff");
    expect(sanitizeBackground("   ")).toBe("#fff");
  });

  it("accepts ordinary colour values", () => {
    expect(sanitizeBackground("#0b1120")).toBe("#0b1120");
    expect(sanitizeBackground("rgb(11, 17, 32)")).toBe("rgb(11, 17, 32)");
    expect(sanitizeBackground(" black ")).toBe("black");
  });

  it("rejects anything that could escape the rule it is interpolated into", () => {
    expect(sanitizeBackground("red}body{display:none")).toBe("#fff");
    // Also rejected, and deliberately: a cloak that can name a remote URL is a cloak that
    // can make the customer's page fetch one.
    expect(sanitizeBackground("url(https://evil.test/x)")).toBe("#fff");
    expect(sanitizeBackground('#fff;}*{content:"x"')).toBe("#fff");
  });
});

describe("clampCloakMs", () => {
  it("defaults to 1250ms", () => {
    // Pinned deliberately. This is the ceiling on how long a visitor can be shown a blank
    // page, so it should not drift without someone deciding that it should.
    expect(DEFAULT_CLOAK_MS).toBe(1250);
  });

  it("falls back to the default for missing or nonsensical values", () => {
    expect(clampCloakMs(undefined)).toBe(DEFAULT_CLOAK_MS);
    expect(clampCloakMs(NaN)).toBe(DEFAULT_CLOAK_MS);
    expect(clampCloakMs(0)).toBe(DEFAULT_CLOAK_MS);
    expect(clampCloakMs(-1)).toBe(DEFAULT_CLOAK_MS);
  });

  it("caps the value so a typo cannot blank a site", () => {
    expect(clampCloakMs(800)).toBe(800);
    expect(clampCloakMs(60_000)).toBe(4000);
  });
});

describe("cloakCss", () => {
  it("covers the viewport without touching the host page's own box model", () => {
    const css = cloakCss("#fff");

    expect(css).toContain("body::after");
    expect(css).toContain("position:fixed!important");
    // Mida's snippet sets these on `body` itself; mutating the host layout can reflow visibly
    // when the cloak lifts, so this rule must not contain them.
    expect(css).not.toContain("overflow:hidden");
    expect(css).not.toContain("position:relative");
  });

  it("marks every declaration important so a later stylesheet cannot win on order", () => {
    const declarations = cloakCss("#fff")
      .replace(/^.*\{|\}$/g, "")
      .split(";");

    expect(declarations.length).toBeGreaterThan(0);
    for (const declaration of declarations) expect(declaration).toContain("!important");
  });
});

describe("applyCloak", () => {
  it("appends exactly one style element and removes it on reveal", () => {
    const doc = fakeDocument();
    const cloak = applyCloak(asDocument(doc));

    expect(doc.children).toHaveLength(1);
    expect(doc.children[0]?.id).toBe("routely-cloak");

    cloak.reveal();
    expect(doc.children).toHaveLength(0);
  });

  it("is idempotent — a second reveal is harmless", () => {
    const doc = fakeDocument();
    const cloak = applyCloak(asDocument(doc));

    cloak.reveal();
    cloak.reveal();

    expect(doc.children).toHaveLength(0);
  });

  it("lifts itself after the timeout even if nothing ever calls reveal", () => {
    vi.useFakeTimers();
    try {
      const doc = fakeDocument();
      applyCloak(asDocument(doc), { timeoutMs: 500 });

      expect(doc.children).toHaveLength(1);
      vi.advanceTimersByTime(499);
      expect(doc.children).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(doc.children).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels its timeout once revealed, so a later boot's cloak survives", () => {
    vi.useFakeTimers();
    try {
      const doc = fakeDocument();

      applyCloak(asDocument(doc), { timeoutMs: 500 }).reveal();
      // A second page-load cycle in the same document, cloaked again before the first timer
      // would have fired.
      applyCloak(asDocument(doc), { timeoutMs: 500 });

      vi.advanceTimersByTime(400);
      expect(doc.children).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not stack a second cloak over one already applied", () => {
    const doc = fakeDocument();
    applyCloak(asDocument(doc));
    const second = applyCloak(asDocument(doc));

    expect(doc.children).toHaveLength(1);

    // The second handle must not reveal a cloak it does not own.
    second.reveal();
    expect(doc.children).toHaveLength(1);
  });

  it("does nothing when there is no document", () => {
    expect(() => applyCloak(undefined).reveal()).not.toThrow();
  });

  it("leaves the page alone when the DOM refuses to cooperate", () => {
    const doc = fakeDocument({
      head: null,
      getElementsByTagName: () => [],
    });

    expect(() => applyCloak(asDocument(doc)).reveal()).not.toThrow();
    expect(doc.children).toHaveLength(0);
  });

  it("never throws into the host page when appending fails", () => {
    const doc = fakeDocument({
      head: {
        appendChild() {
          throw new Error("CSP blocked inline style");
        },
      },
    });

    expect(() => applyCloak(asDocument(doc)).reveal()).not.toThrow();
  });
});
