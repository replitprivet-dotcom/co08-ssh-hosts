import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  prefix: varchar("prefix", { length: 24 }).notNull().unique(),
  keyHash: varchar("keyHash", { length: 128 }).notNull().unique(),
  hostQuota: int("hostQuota").default(25).notNull(),
  requestsPerMinute: int("requestsPerMinute").default(30).notNull(),
  requestCount: int("requestCount").default(0).notNull(),
  lastRequestAt: timestamp("lastRequestAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("api_keys_user_idx").on(table.userId) }));

export const hosts = mysqlTable("hosts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  apiKeyId: int("apiKeyId"),
  hostname: varchar("hostname", { length: 255 }).notNull().unique(),
  ip: varchar("ip", { length: 45 }).notNull(),
  ttl: int("ttl").default(300).notNull(),
  expiresAt: timestamp("expiresAt"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  status: mysqlEnum("status", ["active", "expired", "deleted"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userIdx: index("hosts_user_idx").on(table.userId), statusIdx: index("hosts_status_idx").on(table.status), expiresIdx: index("hosts_expires_idx").on(table.expiresAt), scheduleIdx: index("hosts_schedule_idx").on(table.scheduleCronTaskUid) }));

export const dnsRecords = mysqlTable("dns_records", {
  id: int("id").autoincrement().primaryKey(),
  hostId: int("hostId").notNull().unique(),
  cloudflareRecordId: varchar("cloudflareRecordId", { length: 64 }).notNull().unique(),
  recordType: varchar("recordType", { length: 8 }).default("A").notNull(),
  proxied: int("proxied").default(0).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 80 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  apiKeyId: int("apiKeyId"),
  action: varchar("action", { length: 80 }).notNull(),
  resource: varchar("resource", { length: 255 }),
  ip: varchar("ip", { length: 45 }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ createdIdx: index("audit_created_idx").on(table.createdAt), actionIdx: index("audit_action_idx").on(table.action) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Host = typeof hosts.$inferSelect;
export type DnsRecord = typeof dnsRecords.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
