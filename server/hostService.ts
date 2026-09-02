import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { TRPCError } from "@trpc/server";
import { addAuditLog, addDnsRecord, countHostsForApiKey, createBootstrapToken, createHost, consumeBootstrapToken, findApiKey, getDnsRecord, getHostById, hostExists, markDnsDeleted, markHost, renewHost, touchApiKey } from "./db";
import { createARecord, deleteDnsRecord } from "./cloudflare";
import type { ApiKey } from "../drizzle/schema";

export function isPublicIpv4(ip: string) {
  const parts = ip.trim().split(".");
  if (parts.length !== 4 || parts.some(p => !/^\d{1,3}$/.test(p))) return false;
  const nums = parts.map(Number);
  if (nums.some(n => n < 0 || n > 255)) return false;
  return !(nums[0] === 10 || nums[0] === 127 || (nums[0] === 169 && nums[1] === 254) || (nums[0] === 192 && nums[1] === 168) || (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) || nums.every(n => n === 0) || nums[0] >= 224);
}
export function generateHostname(domain: string) { return `ip-${randomBytes(4).toString("hex")}.${domain}`.toLowerCase(); }
export function hashApiKey(key: string) { return createHash("sha256").update(key).digest("hex"); }
export function createManagementProof(managementId: string, ttlSeconds = 86400) { const exp = Math.floor(Date.now() / 1000) + ttlSeconds; const payload = `${managementId}.${exp}`; const sig = createHmac("sha256", process.env.JWT_SECRET || "co08-dev-secret").update(payload).digest("base64url"); return `${payload}.${sig}`; }
export function verifyManagementProof(managementId: string, proof: string | undefined) { if (!proof) return false; const [id, expText, sig] = proof.split("."); if (id !== managementId || !expText || !sig || Number(expText) < Math.floor(Date.now() / 1000)) return false; const expected = createHmac("sha256", process.env.JWT_SECRET || "co08-dev-secret").update(`${id}.${expText}`).digest("base64url"); return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); }
export function issueApiKey() { const secret = `co08_${randomBytes(24).toString("base64url")}`; return { secret, prefix: secret.slice(0, 14), hash: hashApiKey(secret) }; }
export function buildBootstrapCommand(baseUrl: string, secret: string) { const url = new URL(`/api/bootstrap/${secret}`, baseUrl); return `curl -fsSL ${url.toString()} | sudo bash`; }
export function renderBootstrapScript(baseUrl: string, secret: string) { return `#!/bin/sh\nset -eu\nIP=$(curl -4fsSL https://api.ipify.org)\nprintf 'Detected VPS IPv4: %s\\n' "$IP"\ncurl -fsSL -X POST ${new URL("/api/bootstrap/complete", baseUrl).toString()} -H 'content-type: application/json' --data '{"token":"${secret}","ip":"'"$IP"'"}'\nprintf '\\nBootstrap complete. Use the returned SSH command.\\n'\n`; }
export async function issueBootstrapToken(userId: number, requestIp?: string) { const secret = `boot_${randomBytes(32).toString("base64url")}`; await createBootstrapToken({ userId, tokenHash: hashApiKey(secret), expiresAt: new Date(Date.now() + 15 * 60 * 1000) }); await addAuditLog({ userId, action: "bootstrap.issue", ip: requestIp, details: JSON.stringify({ ttlSeconds: 900 }) }); return secret; }
export async function consumeBootstrapSecret(secret: string, requestIp?: string) { const token = await consumeBootstrapToken(hashApiKey(secret)); if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Bootstrap token is invalid, expired, or already used" }); await addAuditLog({ userId: token.userId, action: "bootstrap.consume", ip: requestIp }); return token; }
export function expirationFromSeconds(seconds?: number | null) { return seconds && seconds > 0 ? new Date(Date.now() + Math.min(seconds, 604800) * 1000) : null; }
export function rateLimitExceeded(lastRequestAt: Date | null | undefined, requestCount: number, limit: number, now = Date.now()) { return !!lastRequestAt && now - lastRequestAt.getTime() < 60000 && requestCount >= limit; }
export function shouldExpireHost(status: string, expiresAt: Date | null | undefined, now = Date.now()) { return status === "active" && !!expiresAt && expiresAt.getTime() <= now; }
export async function processExpiredHosts<T extends { id: number; hostname: string }>(rows: T[], actions: { removeDns: (row: T) => Promise<void>; markExpired: (row: T) => Promise<void>; audit: (row: T) => Promise<void> }) { for (const row of rows) { await actions.removeDns(row); await actions.markExpired(row); await actions.audit(row); } return rows.length; }

export async function createManagedHost(input: { userId: number; ip: string; ttl: number; expiresAt: Date | null; apiKeyId?: number; requestIp?: string }) {
  if (!isPublicIpv4(input.ip)) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid public IPv4 address." });
  let hostname = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateHostname(process.env.DOMAIN || "co08.art");
    if (!(await hostExists(candidate))) { hostname = candidate; break; }
  }
  if (!hostname) throw new TRPCError({ code: "CONFLICT", message: "Unable to allocate a unique hostname" });
  const record = await createARecord(hostname, input.ip, input.ttl);
  try {
    const managementId = `u-${randomBytes(12).toString("base64url")}`; const hostId = await createHost({ userId: input.userId, apiKeyId: input.apiKeyId, hostname, managementId, ip: input.ip, ttl: input.ttl, expiresAt: input.expiresAt, status: "active" });
    await addDnsRecord({ hostId, cloudflareRecordId: record.id, recordType: "A", proxied: 0 });
    await addAuditLog({ userId: input.userId, apiKeyId: input.apiKeyId, action: "dns.create", resource: hostname, ip: input.requestIp, details: JSON.stringify({ recordId: record.id, target: input.ip, proxied: false }) });
    if (input.apiKeyId) await touchApiKey(input.apiKeyId);
    return { id: hostId, managementId, managementProof: createManagementProof(managementId), hostname, ip: input.ip, sshCommand: `ssh root@${hostname}`, expiresAt: input.expiresAt, status: "active" as const };
  } catch (error) {
    await deleteDnsRecord(record.id).catch(() => undefined);
    throw error;
  }
}

export async function deleteManagedHost(userId: number, id: number, requestIp?: string) {
  const host = await getHostById(id); if (!host || host.userId !== userId) throw new TRPCError({ code: "NOT_FOUND", message: "Host not found" });
  const dns = await getDnsRecord(id); if (dns && !dns.deletedAt) await deleteDnsRecord(dns.cloudflareRecordId);
  await markDnsDeleted(id); await markHost(id, "deleted");
  await addAuditLog({ userId, action: "dns.delete", resource: host.hostname, ip: requestIp, details: JSON.stringify({ recordId: dns?.cloudflareRecordId }) });
  return { success: true };
}

export async function authenticateApiKey(raw: string | undefined, requestIp?: string): Promise<ApiKey> {
  if (!raw) { await addAuditLog({ action: "api.auth.missing", ip: requestIp }); throw new TRPCError({ code: "UNAUTHORIZED", message: "API key required" }); }
  const key = await findApiKey(hashApiKey(raw));
  if (!key) { await addAuditLog({ action: "api.auth.invalid", ip: requestIp }); throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid API key" }); }
  if (key.revokedAt) { await addAuditLog({ apiKeyId: key.id, action: "api.auth.revoked", ip: requestIp }); throw new TRPCError({ code: "UNAUTHORIZED", message: "API key revoked" }); }
  const now = Date.now();
  if (rateLimitExceeded(key.lastRequestAt, key.requestCount, key.requestsPerMinute, now)) { await addAuditLog({ userId: key.userId, apiKeyId: key.id, action: "api.auth.rate_limited", ip: requestIp }); throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "API rate limit exceeded" }); }
  const hostCount = await countHostsForApiKey(key.id); if (hostCount >= key.hostQuota) { await addAuditLog({ userId: key.userId, apiKeyId: key.id, action: "api.auth.quota_rejected", ip: requestIp }); throw new TRPCError({ code: "FORBIDDEN", message: "API key host quota exceeded" }); }
  return key;
}
