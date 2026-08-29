import { isIP } from "node:net";

/**
 * Classifying IP addresses that must never be reachable through a server-side fetch of a
 * customer-supplied URL.
 *
 * Kept as a dependency-free module rather than living inside the service that uses it: this is
 * the security-critical half of the install check, and it should be testable without dragging
 * in the database client and environment validation that a service import brings with it.
 */

/**
 * True for loopback, link-local (which includes the cloud metadata address), private ranges,
 * CGNAT, benchmarking, multicast and reserved space.
 *
 * IPv4-mapped IPv6 is unwrapped first, so `::ffff:127.0.0.1` cannot slip past as an opaque v6
 * address. Anything unparseable is reported as private — for a guard, refusing what it cannot
 * understand is the only safe default.
 */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;

  if (family === 6) {
    const lower = address.toLowerCase();

    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);

    if (lower === "::" || lower === "::1") return true;
    // fc00::/7 (unique local) and fe80::/10 (link-local).
    return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
  }

  const [a = 0, b = 0] = address.split(".").map(Number);

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved

  return false;
}
