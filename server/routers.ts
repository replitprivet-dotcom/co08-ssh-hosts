import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { addAuditLog, countHosts, createApiKey, getHost, listApiKeys, listAuditLogs, listHosts, revokeApiKey, renewHost, setSetting } from "./db";
import { parse as parseCookie } from "cookie";
import { createHeartbeatJob } from "./_core/heartbeat";
import { testCloudflareConnection } from "./cloudflare";
import { createManagedHost, deleteManagedHost, expirationFromSeconds, issueApiKey } from "./hostService";

const ttlSchema = z.union([z.literal(300), z.literal(600), z.literal(3600)]).default(300);
const expirationSchema = z.number().int().min(0).max(604800).nullable().optional();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  hosts: router({
    stats: protectedProcedure.query(({ ctx }) => countHosts(ctx.user.id)),
    list: protectedProcedure.query(({ ctx }) => listHosts(ctx.user.id)),
    activity: protectedProcedure.query(({ ctx }) => listAuditLogs(ctx.user.id)),
    create: protectedProcedure.input(z.object({ ip: z.string(), ttl: ttlSchema, expiresIn: expirationSchema })).mutation(async ({ ctx, input }) => createManagedHost({ userId: ctx.user.id, ip: input.ip, ttl: input.ttl, expiresAt: expirationFromSeconds(input.expiresIn), requestIp: ctx.req.ip })),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteManagedHost(ctx.user.id, input.id, ctx.req.ip)),
    renew: protectedProcedure.input(z.object({ id: z.number().int().positive(), expiresIn: z.number().int().min(3600).max(604800) })).mutation(async ({ ctx, input }) => { const ownedHost = await getHost(ctx.user.id, input.id); if (!ownedHost) throw new Error("Host not found"); const expiresAt = expirationFromSeconds(input.expiresIn); await renewHost(input.id, expiresAt); await addAuditLog({ userId: ctx.user.id, action: "host.renew", resource: String(input.id), ip: ctx.req.ip, details: JSON.stringify({ expiresAt }) }); return { success: true, expiresAt }; }),
  }),
  apiKeys: router({
    list: protectedProcedure.query(({ ctx }) => listApiKeys(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), hostQuota: z.number().int().min(1).max(1000).default(25) })).mutation(async ({ ctx, input }) => { const issued = issueApiKey(); const id = await createApiKey({ userId: ctx.user.id, name: input.name, prefix: issued.prefix, keyHash: issued.hash, hostQuota: input.hostQuota, requestsPerMinute: 30 }); await addAuditLog({ userId: ctx.user.id, action: "api_key.create", resource: issued.prefix, ip: ctx.req.ip }); return { id, name: input.name, prefix: issued.prefix, secret: issued.secret }; }),
    revoke: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await revokeApiKey(ctx.user.id, input.id); await addAuditLog({ userId: ctx.user.id, action: "api_key.revoke", resource: String(input.id), ip: ctx.req.ip }); return { success: true }; }),
  }),
  settings: router({
    cloudflareStatus: adminProcedure.query(async () => { try { return await testCloudflareConnection(); } catch (error) { return { connected: false, domain: process.env.DOMAIN || "co08.art", message: error instanceof Error ? error.message : "Connection failed" }; } }),
    scheduleCleanup: adminProcedure.mutation(async ({ ctx }) => { const session = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? ""; const job = await createHeartbeatJob({ name: "cleanup-expired-hosts", cron: "0 0 * * * *", path: "/api/scheduled/cleanup-expired", description: "Delete expired co08.art DNS records" }, session); await setSetting("cleanup_heartbeat_task_uid", job.taskUid); await addAuditLog({ userId: ctx.user.id, action: "schedule.create", resource: job.taskUid, ip: ctx.req.ip }); return job; }),
  }),
});
export type AppRouter = typeof appRouter;
