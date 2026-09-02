import { Router } from "express";
import { consumeBootstrapSecret, createManagedHost, renderBootstrapScript } from "./hostService";

export function createBootstrapRouter() {
  const router = Router();
  router.get("/:secret", (req, res) => { const baseUrl = `${req.protocol}://${req.get("host")}`; res.type("text/plain").send(renderBootstrapScript(baseUrl, String(req.params.secret))); });
  router.post("/complete", async (req, res) => { try { const token = await consumeBootstrapSecret(String(req.body?.token || ""), req.ip); const host = await createManagedHost({ userId: token.userId, ip: String(req.body?.ip || ""), ttl: 300, expiresAt: null, requestIp: req.ip }); res.status(201).json({ success: true, hostname: host.hostname, ssh_command: host.sshCommand, ip: host.ip }); } catch (error) { res.status(401).json({ success: false, error: error instanceof Error ? error.message : "Bootstrap failed" }); } });
  return router;
}
