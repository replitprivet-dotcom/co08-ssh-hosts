import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { deleteDnsRecord } from "../cloudflare";
import { createBootstrapRouter } from "../bootstrapRoutes";
import { createManagementRouter } from "../managementRoutes";
import { addAuditLog, expireHosts, getDnsRecord, markDnsDeleted, markHost, getHostById, getHostByManagementId, renewHost, touchApiKey } from "../db";
import { authenticateApiKey, consumeBootstrapSecret, createManagedHost, expirationFromSeconds, processExpiredHosts, renderBootstrapScript, verifyManagementProof } from "../hostService";

function isPortAvailable(port: number): Promise<boolean> { return new Promise(resolve => { const server = net.createServer(); server.listen(port, () => server.close(() => resolve(true))); server.on("error", () => resolve(false)); }); }
async function findAvailablePort(startPort = 3000) { for (let port = startPort; port < startPort + 20; port++) if (await isPortAvailable(port)) return port; throw new Error("No available port found"); }
function securityHeaders(_req: express.Request, res: express.Response, next: express.NextFunction) { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("Content-Security-Policy", "default-src 'self' https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; connect-src 'self' https:"); next(); }

async function startServer() {
  const app = express(); const server = createServer(app);
  app.use(securityHeaders); app.use(express.json({ limit: "50kb" })); app.use(express.urlencoded({ limit: "50kb", extended: true }));
  registerStorageProxy(app); registerOAuthRoutes(app);
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/bootstrap", createBootstrapRouter());
  app.use("/api/manage", createManagementRouter());
  app.get("/api/manage/:managementId", async (req, res) => { const managementId = String(req.params.managementId); if (!verifyManagementProof(managementId, String(req.query.proof || req.headers["x-co08-proof"] || ""))) return res.status(401).json({ error: "management_proof_required" }); const host = await getHostByManagementId(managementId); if (!host) return res.status(404).json({ error: "Management ID not found" }); res.json({ management_id: host.managementId, hostname: host.hostname, ip: host.ip, status: host.status, expires_at: host.expiresAt, created_at: host.createdAt }); });
  app.post("/api/manage/:managementId/stop", async (req, res) => { const managementId = String(req.params.managementId); if (!verifyManagementProof(managementId, String(req.body?.proof || req.headers["x-co08-proof"] || ""))) return res.status(401).json({ error: "management_proof_required" }); const host = await getHostByManagementId(managementId); if (!host) return res.status(404).json({ error: "Management ID not found" }); const dns = await getDnsRecord(host.id); if (dns && !dns.deletedAt) await deleteDnsRecord(dns.cloudflareRecordId); await markDnsDeleted(host.id); await markHost(host.id, "deleted"); await addAuditLog({ userId: host.userId, action: "management.stop", resource: host.hostname, ip: req.ip }); res.json({ success: true, management_id: host.managementId, status: "deleted" }); });
  app.post("/api/manage/:managementId/regenerate", async (req, res) => { const managementId = String(req.params.managementId); if (!verifyManagementProof(managementId, String(req.body?.proof || req.headers["x-co08-proof"] || ""))) return res.status(401).json({ error: "management_proof_required" }); const host = await getHostByManagementId(managementId); if (!host) return res.status(404).json({ error: "Management ID not found" }); const replacement = await createManagedHost({ userId: host.userId, ip: host.ip, ttl: host.ttl, expiresAt: host.expiresAt, requestIp: req.ip }); const dns = await getDnsRecord(host.id); if (dns && !dns.deletedAt) await deleteDnsRecord(dns.cloudflareRecordId); await markDnsDeleted(host.id); await markHost(host.id, "deleted"); await addAuditLog({ userId: host.userId, action: "management.regenerate", resource: replacement.hostname, ip: req.ip }); res.status(201).json({ success: true, old_management_id: host.managementId, management_id: replacement.managementId, hostname: replacement.hostname, ssh_command: replacement.sshCommand }); });
  app.use("/api/v1", (req, res, next) => { res.on("finish", () => { addAuditLog({ action: "api.request", resource: `${req.method} ${req.path}`, ip: req.ip, details: JSON.stringify({ status: res.statusCode }) }).catch(() => undefined); }); next(); });

  app.post("/api/v1/hosts", async (req, res) => {
    try { const key = await authenticateApiKey(req.headers.authorization?.replace(/^Bearer /, ""), req.ip); const host = await createManagedHost({ userId: key.userId, apiKeyId: key.id, ip: String(req.body?.ip || ""), ttl: [300, 600, 3600].includes(Number(req.body?.ttl)) ? Number(req.body.ttl) : 300, expiresAt: expirationFromSeconds(req.body?.expires_in), requestIp: req.ip }); res.status(201).json({ success: true, hostname: host.hostname, ip: host.ip, ssh_command: host.sshCommand, expires_at: host.expiresAt, status: host.status }); } catch (error) { const status = error instanceof Error && error.message.includes("rate limit") ? 429 : 400; res.status(status).json({ success: false, error: error instanceof Error ? error.message : "Request failed" }); }
  });
  app.get("/api/v1/hosts", async (req, res) => { try { const key = await authenticateApiKey(req.headers.authorization?.replace(/^Bearer /, ""), req.ip); const { listHosts } = await import("../db"); await touchApiKey(key.id); res.json({ success: true, hosts: await listHosts(key.userId) }); } catch (error) { res.status(401).json({ success: false, error: error instanceof Error ? error.message : "Unauthorized" }); } });
  app.delete("/api/v1/hosts/:id", async (req, res) => { try { const key = await authenticateApiKey(req.headers.authorization?.replace(/^Bearer /, ""), req.ip); await touchApiKey(key.id); const host = await getHostById(Number(req.params.id)); if (!host || host.userId !== key.userId) return res.status(404).json({ success: false, error: "Host not found" }); const dns = await getDnsRecord(host.id); if (dns && !dns.deletedAt) await deleteDnsRecord(dns.cloudflareRecordId); await markDnsDeleted(host.id); await markHost(host.id, "deleted"); await addAuditLog({ userId: key.userId, apiKeyId: key.id, action: "dns.delete", resource: host.hostname, ip: req.ip }); res.json({ success: true }); } catch (error) { res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Delete failed" }); } });
  app.post("/api/v1/hosts/:id/renew", async (req, res) => { try { const key = await authenticateApiKey(req.headers.authorization?.replace(/^Bearer /, ""), req.ip); await touchApiKey(key.id); const host = await getHostById(Number(req.params.id)); if (!host || host.userId !== key.userId) return res.status(404).json({ success: false, error: "Host not found" }); const expiresAt = expirationFromSeconds(req.body?.expires_in || 86400); await renewHost(host.id, expiresAt); await addAuditLog({ userId: key.userId, apiKeyId: key.id, action: "host.renew", resource: host.hostname, ip: req.ip }); res.json({ success: true, expires_at: expiresAt, status: "active" }); } catch (error) { res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Renew failed" }); } });

  app.post("/api/scheduled/cleanup-expired", async (req, res) => { try { const user = await sdk.authenticateRequest(req); if (!user.isCron) return res.status(403).json({ error: "cron-only" }); const rows = await expireHosts(); await processExpiredHosts(rows, { removeDns: async host => { const dns = await getDnsRecord(host.id); if (dns && !dns.deletedAt) await deleteDnsRecord(dns.cloudflareRecordId).catch(() => undefined); await markDnsDeleted(host.id); }, markExpired: host => markHost(host.id, "expired"), audit: host => addAuditLog({ action: "dns.expire", resource: host.hostname, details: JSON.stringify({ taskUid: user.taskUid }) }) }); res.json({ ok: true, expired: rows.length }); } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Cleanup failed", timestamp: new Date().toISOString() }); } });

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  if (process.env.NODE_ENV === "development") await setupVite(app, server); else serveStatic(app);
  const preferredPort = parseInt(process.env.PORT || "3000"); const port = await findAvailablePort(preferredPort); if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`); server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}
startServer().catch(console.error);
