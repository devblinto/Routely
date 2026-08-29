import { describe, expect, it } from "vitest";

import { isPrivateAddress } from "@/lib/private-address";

/**
 * The install check fetches a URL the customer supplies, so this guard is what stops it being
 * a general-purpose "make the server request this for me" endpoint. Every case below is an
 * address that must never be reachable through it.
 */
describe("isPrivateAddress", () => {
  it("rejects loopback", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("127.10.20.30")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
  });

  it("rejects the cloud metadata address", () => {
    // The single most valuable SSRF target on any major host.
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
  });

  it("rejects RFC1918 private ranges", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("172.31.255.255")).toBe(true);
  });

  it("allows the public addresses either side of the 172.16/12 block", () => {
    // 172.15 and 172.32 are ordinary public space — an off-by-one here would block real sites.
    expect(isPrivateAddress("172.15.0.1")).toBe(false);
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
  });

  it("rejects CGNAT, benchmarking, multicast and reserved space", () => {
    expect(isPrivateAddress("100.64.0.1")).toBe(true);
    expect(isPrivateAddress("198.18.0.1")).toBe(true);
    expect(isPrivateAddress("224.0.0.1")).toBe(true);
    expect(isPrivateAddress("255.255.255.255")).toBe(true);
    expect(isPrivateAddress("0.0.0.0")).toBe(true);
  });

  it("unwraps IPv4-mapped IPv6 rather than reading it as an opaque v6 address", () => {
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("rejects IPv6 unique-local and link-local", () => {
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fd12:3456::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("::")).toBe(true);
  });

  it("allows ordinary public addresses", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });

  it("refuses anything it cannot parse rather than defaulting to allowed", () => {
    expect(isPrivateAddress("")).toBe(true);
    expect(isPrivateAddress("not-an-ip")).toBe(true);
    expect(isPrivateAddress("999.999.999.999")).toBe(true);
  });
});
