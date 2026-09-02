import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { apiKeys, auditLogs, bootstrapTokens, dnsRecords, hosts, InsertUser, systemSettings, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = values[field]; }
  if (user.role) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]; }

export async function listHosts(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(hosts).where(and(eq(hosts.userId, userId), or(eq(hosts.status, "active"), eq(hosts.status, "expired")))).orderBy(desc(hosts.createdAt)); }
export async function getHost(userId: number, id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(hosts).where(and(eq(hosts.userId, userId), eq(hosts.id, id))).limit(1))[0]; }
export async function getHostByManagementId(managementId: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(hosts).where(eq(hosts.managementId, managementId)).limit(1))[0]; }
export async function getHostById(id: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(hosts).where(eq(hosts.id, id)).limit(1))[0]; }
export async function hostExists(hostname: string) { const db = await getDb(); if (!db) return false; return (await db.select({ id: hosts.id }).from(hosts).where(eq(hosts.hostname, hostname)).limit(1)).length > 0; }
export async function createHost(data: typeof hosts.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const result = await db.insert(hosts).values(data); return Number(result[0].insertId); }
export async function addDnsRecord(data: typeof dnsRecords.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(dnsRecords).values(data); }
export async function getDnsRecord(hostId: number) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(dnsRecords).where(eq(dnsRecords.hostId, hostId)).limit(1))[0]; }
export async function markHost(id: number, status: "active" | "expired" | "deleted") { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(hosts).set({ status, updatedAt: new Date() }).where(eq(hosts.id, id)); }
export async function renewHost(id: number, expiresAt: Date | null) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(hosts).set({ expiresAt, status: "active", updatedAt: new Date() }).where(eq(hosts.id, id)); }
export async function countHosts(userId: number) { const db = await getDb(); if (!db) return { total: 0, active: 0, expired: 0, expiringSoon: 0, apiRequests: 0 }; const rows = await db.select({ status: hosts.status, expiresAt: hosts.expiresAt }).from(hosts).where(and(eq(hosts.userId, userId), or(eq(hosts.status, "active"), eq(hosts.status, "expired")))); const requestRows = await db.select({ id: auditLogs.id }).from(auditLogs).where(sql`${auditLogs.action} = 'api.request' AND (${auditLogs.userId} = ${userId} OR ${auditLogs.userId} IS NULL)`); const now = Date.now(); return { total: rows.length, active: rows.filter(r => r.status === "active").length, expired: rows.filter(r => r.status === "expired").length, expiringSoon: rows.filter(r => r.status === "active" && r.expiresAt && r.expiresAt.getTime() - now < 86400000 && r.expiresAt.getTime() > now).length, apiRequests: requestRows.length }; }
export async function listAuditLogs(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(40); }
export async function addAuditLog(data: typeof auditLogs.$inferInsert) { const db = await getDb(); if (!db) return; await db.insert(auditLogs).values(data); }

export async function createApiKey(data: typeof apiKeys.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const result = await db.insert(apiKeys).values(data); return Number(result[0].insertId); }
export async function listApiKeys(userId: number) { const db = await getDb(); if (!db) return []; return db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, hostQuota: apiKeys.hostQuota, requestsPerMinute: apiKeys.requestsPerMinute, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt }).from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt)); }
export async function findApiKey(keyHash: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1))[0]; }
export async function revokeApiKey(userId: number, id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.userId, userId), eq(apiKeys.id, id))); }
export async function countHostsForApiKey(apiKeyId: number) { const db = await getDb(); if (!db) return 0; const result = await db.select({ count: sql<number>`count(*)` }).from(hosts).where(and(eq(hosts.apiKeyId, apiKeyId), or(eq(hosts.status, "active"), eq(hosts.status, "expired")))); return Number(result[0]?.count ?? 0); }
export async function touchApiKey(id: number) { const db = await getDb(); if (!db) return; const key = (await db.select({ requestCount: apiKeys.requestCount, lastRequestAt: apiKeys.lastRequestAt }).from(apiKeys).where(eq(apiKeys.id, id)).limit(1))[0]; const reset = !key?.lastRequestAt || Date.now() - key.lastRequestAt.getTime() >= 60000; await db.update(apiKeys).set({ requestCount: reset ? 1 : sql`${apiKeys.requestCount} + 1`, lastRequestAt: new Date() }).where(eq(apiKeys.id, id)); }
export async function expireHosts() { const db = await getDb(); if (!db) return []; const rows = await db.select().from(hosts).where(and(eq(hosts.status, "active"), lt(hosts.expiresAt, new Date()), sql`${hosts.expiresAt} IS NOT NULL`)); return rows; }
export async function markDnsDeleted(hostId: number) { const db = await getDb(); if (!db) return; await db.update(dnsRecords).set({ deletedAt: new Date() }).where(eq(dnsRecords.hostId, hostId)); }
export async function createBootstrapToken(data: typeof bootstrapTokens.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const result = await db.insert(bootstrapTokens).values(data); return Number(result[0].insertId); }
export async function consumeBootstrapToken(tokenHash: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(bootstrapTokens).where(and(eq(bootstrapTokens.tokenHash, tokenHash), isNull(bootstrapTokens.usedAt), gt(bootstrapTokens.expiresAt, new Date()))).limit(1); const row = result[0]; if (!row) return undefined; await db.update(bootstrapTokens).set({ usedAt: new Date() }).where(and(eq(bootstrapTokens.id, row.id), isNull(bootstrapTokens.usedAt))); return row; }
export async function getSetting(key: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1))[0]; }
export async function setSetting(key: string, value: string) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(systemSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } }); }

