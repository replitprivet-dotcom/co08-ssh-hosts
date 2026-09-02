import { beforeEach, describe, expect, it, vi } from "vitest";

const findApiKey = vi.fn();
const countHostsForApiKey = vi.fn();
const addAuditLog = vi.fn(async () => undefined);
const createBootstrapToken = vi.fn(async () => 1);
const consumeBootstrapToken = vi.fn();
vi.mock("./db", () => ({ findApiKey, countHostsForApiKey, addAuditLog, createBootstrapToken, consumeBootstrapToken }));

const { authenticateApiKey, buildBootstrapCommand, consumeBootstrapSecret, issueBootstrapToken, processExpiredHosts } = await import("./hostService");

describe("API-key authentication outcomes", () => {
  beforeEach(() => { vi.clearAllMocks(); countHostsForApiKey.mockResolvedValue(0); });
  it("audits invalid keys", async () => { findApiKey.mockResolvedValue(undefined); await expect(authenticateApiKey("bad", "1.2.3.4")).rejects.toThrow("Invalid API key"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "api.auth.invalid" })); });
  it("audits revoked keys", async () => { findApiKey.mockResolvedValue({ id: 1, userId: 2, revokedAt: new Date(), requestCount: 0, requestsPerMinute: 30 }); await expect(authenticateApiKey("bad", "1.2.3.4")).rejects.toThrow("revoked"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "api.auth.revoked" })); });
  it("audits quota rejection", async () => { findApiKey.mockResolvedValue({ id: 1, userId: 2, revokedAt: null, requestCount: 0, requestsPerMinute: 30, hostQuota: 1, lastRequestAt: null }); countHostsForApiKey.mockResolvedValue(1); await expect(authenticateApiKey("key", "1.2.3.4")).rejects.toThrow("quota"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "api.auth.quota_rejected" })); });
  it("audits rate limiting", async () => { findApiKey.mockResolvedValue({ id: 1, userId: 2, revokedAt: null, requestCount: 30, requestsPerMinute: 30, hostQuota: 10, lastRequestAt: new Date() }); await expect(authenticateApiKey("key", "1.2.3.4")).rejects.toThrow("rate limit"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "api.auth.rate_limited" })); });
});

describe("bootstrap token flow", () => {
  it("stores only a hash and creates a 15-minute token", async () => { const before = Date.now(); const secret = await issueBootstrapToken(7, "1.2.3.4"); const stored = createBootstrapToken.mock.calls[0]?.[0]; expect(secret).toMatch(/^boot_/); expect(stored).toEqual(expect.objectContaining({ userId: 7, tokenHash: expect.not.stringContaining(secret), expiresAt: expect.any(Date) })); expect((stored as any).expiresAt.getTime()).toBeGreaterThanOrEqual(before + 14 * 60 * 1000); expect((stored as any).expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "bootstrap.issue" })); });
});

describe("bootstrap command and consumption", () => {
  it("uses the public app host and rejects expired or consumed tokens", async () => { const command = buildBootstrapCommand("https://panel.example.test", "boot_safe"); expect(command).toContain("https://panel.example.test/api/bootstrap/boot_safe"); expect(command).not.toContain("co08.art"); consumeBootstrapToken.mockResolvedValue(undefined); await expect(consumeBootstrapSecret("expired", "1.2.3.4")).rejects.toThrow("invalid, expired, or already used"); });
  it("consumes a valid token once and rejects the second consume", async () => { consumeBootstrapToken.mockResolvedValueOnce({ id: 1, userId: 7, tokenHash: "hash", expiresAt: new Date(Date.now() + 1000), usedAt: null, createdAt: new Date() }).mockResolvedValueOnce(undefined); await expect(consumeBootstrapSecret("valid", "1.2.3.4")).resolves.toMatchObject({ userId: 7 }); await expect(consumeBootstrapSecret("valid", "1.2.3.4")).rejects.toThrow("invalid, expired, or already used"); expect(addAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "bootstrap.consume" })); });
});

describe("expiration cleanup flow", () => {
  it("removes DNS, marks the row expired, and audits each host", async () => {
    const order: string[] = []; const rows = [{ id: 4, hostname: "vps-deadbeef.co08.art" }];
    const count = await processExpiredHosts(rows, { removeDns: async () => { order.push("dns"); }, markExpired: async () => { order.push("mark"); }, audit: async () => { order.push("audit"); } });
    expect(count).toBe(1); expect(order).toEqual(["dns", "mark", "audit"]);
  });
});
