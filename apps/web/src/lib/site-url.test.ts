import { describe, expect, it } from "vitest";

import { siteOrigin, siteScheme, siteUrl } from "@/lib/site-url";

describe("siteScheme", () => {
  it("maps the enum to a scheme", () => {
    expect(siteScheme("HTTPS")).toBe("https://");
    expect(siteScheme("HTTP")).toBe("http://");
  });
});

describe("siteOrigin", () => {
  it("prefixes the stored domain with its own scheme", () => {
    expect(siteOrigin({ domain: "acme.com", protocol: "HTTPS" })).toBe("https://acme.com");
    expect(siteOrigin({ domain: "ahsan1015.local", protocol: "HTTP" })).toBe(
      "http://ahsan1015.local",
    );
  });
});

describe("siteUrl", () => {
  it("defaults to the site root", () => {
    expect(siteUrl({ domain: "acme.com", protocol: "HTTPS" })).toBe("https://acme.com/");
  });

  it("appends the given path", () => {
    expect(siteUrl({ domain: "acme.com", protocol: "HTTP" }, "/pricing")).toBe(
      "http://acme.com/pricing",
    );
  });

  // The point of storing the scheme: a local http site must never be handed an https suggestion,
  // which is what forced the customer to retype every prefilled URL.
  it("never upgrades an http site to https", () => {
    expect(siteUrl({ domain: "ahsan1015.local", protocol: "HTTP" }, "/thank-you")).not.toContain(
      "https",
    );
  });
});
