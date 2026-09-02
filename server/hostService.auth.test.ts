import { beforeEach, describe, expect, it, vi } from "vitest";

const findApiKey = vi.fn();
const countHostsForApiKey = vi.fn();
const addAuditLog = vi.fn(async () => undefined);
vi.mock("./db", () => ({ findApiKey, countHostsForApiKey, addAuditLog }));

const { authenticateApiKey, processExpiredHosts } = await import("./hostService");

describe("API-key authentication outcomes", () => {
  beforeEach(() => { vi.clearAllMocks(); countHostsForApiKey.mockResolvedValue(0); });
  it("audits invalid keys", async () => { findApiKey.mockResolvedValue(undefined); await expect(authenticateApiKey("bad", "1.2.3.4")).rejects.toThrow("Invalid API key"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "api.auth.invalid" })); });
  it("audits revoked keys", async () => { findApiKey.mockResolvedValue({ id: 1, userId: 2, revokedAt: new Date(), requestCount: 0, requestsPerMinute: 30 }); await expect(authenticateApiKey("bad", "1.2.3.4")).rejects.toThrow("revoked"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "api.auth.revoked" })); });
  it("audits quota rejection", async () => { findApiKey.mockResolvedValue({ id: 1, userId: 2, revokedAt: null, requestCount: 0, requestsPerMinute: 30, hostQuota: 1, lastRequestAt: null }); countHostsForApiKey.mockResolvedValue(1); await expect(authenticateApiKey("key", "1.2.3.4")).rejects.toThrow("quota"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "api.auth.quota_rejected" })); });
  it("audits rate limiting", async () => { findApiKey.mockResolvedValue({ id: 1, userId: 2, revokedAt: null, requestCount: 30, requestsPerMinute: 30, hostQuota: 10, lastRequestAt: new Date() }); await expect(authenticateApiKey("key", "1.2.3.4")).rejects.toThrow("rate limit"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "api.auth.rate_limited" })); });
});

describe("expiration cleanup flow", () => {
  it("removes DNS, marks the row expired, and audits each host", async () => {
    const order: string[] = []; const rows = [{ id: 4, hostname: "vps-deadbeef.co08.art" }];
    const count = await processExpiredHosts(rows, { removeDns: async () => { order.push("dns"); }, markExpired: async () => { order.push("mark"); }, audit: async () => { order.push("audit"); } });
    expect(count).toBe(1); expect(order).toEqual(["dns", "mark", "audit"]);
  });
});
