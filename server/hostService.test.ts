import { describe, expect, it } from "vitest";
import { authenticateApiKey, expirationFromSeconds, generateHostname, hashApiKey, isPublicIpv4, issueApiKey, rateLimitExceeded } from "./hostService";

describe("host security primitives", () => {
  it("accepts public IPv4 and rejects private or malformed addresses", () => {
    expect(isPublicIpv4("208.72.218.153")).toBe(true);
    expect(isPublicIpv4("10.0.0.1")).toBe(false);
    expect(isPublicIpv4("192.168.1.4")).toBe(false);
    expect(isPublicIpv4("999.1.1.1")).toBe(false);
  });
  it("generates a scoped, non-IP hostname", () => {
    const hostname = generateHostname("co08.art");
    expect(hostname).toMatch(/^vps-[a-f0-9]{8}\.co08\.art$/);
    expect(hostname).not.toContain("208");
  });
  it("issues a secret that can only be represented by its hash", () => {
    const issued = issueApiKey();
    expect(issued.secret).toMatch(/^co08_/);
    expect(issued.hash).toBe(hashApiKey(issued.secret));
    expect(issued.hash).not.toContain(issued.secret);
  });
  it("rejects missing API keys", async () => {
    await expect(authenticateApiKey(undefined)).rejects.toThrow("API key required");
  });
  it("enforces a one-minute request window and resets after it", () => {
    const now = Date.now();
    expect(rateLimitExceeded(new Date(now - 1000), 30, 30, now)).toBe(true);
    expect(rateLimitExceeded(new Date(now - 61000), 30, 30, now)).toBe(false);
    expect(rateLimitExceeded(null, 100, 30, now)).toBe(false);
  });
  it("bounds expiration to one week and supports never", () => {
    expect(expirationFromSeconds(null)).toBeNull();
    expect(expirationFromSeconds(0)).toBeNull();
    const expiration = expirationFromSeconds(99999999);
    expect(expiration).not.toBeNull();
    expect(expiration!.getTime() - Date.now()).toBeLessThanOrEqual(604800000);
  });
});
