import express from "express";
import { createServer } from "http";
import { describe, expect, it } from "vitest";
import { createBootstrapRouter } from "./bootstrapRoutes";

async function withServer<T>(fn: (base: string) => Promise<T>) { const app = express(); app.use(express.json()); app.use("/api/bootstrap", createBootstrapRouter()); const server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve())); const address = server.address(); const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`; try { return await fn(base); } finally { server.close(); } }

describe("bootstrap HTTP endpoints", () => {
  it("returns a host-aware shell script", async () => { await withServer(async base => { const response = await fetch(`${base}/api/bootstrap/boot_demo`); const text = await response.text(); expect(response.status).toBe(200); expect(text).toContain("#!/bin/sh"); expect(text).toContain(`${base}/api/bootstrap/complete`); expect(text).not.toContain("co08.art"); }); });
  it("returns an error for an invalid completion token", async () => { await withServer(async base => { const response = await fetch(`${base}/api/bootstrap/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "invalid", ip: "208.72.218.153" }) }); expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ success: false }); }); });
});
