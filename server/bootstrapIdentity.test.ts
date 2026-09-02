import express from "express";
import { createServer } from "http";
import { describe, expect, it, vi } from "vitest";

vi.mock("./hostService", () => ({ consumeBootstrapSecret: async () => ({ userId: 8 }), createManagedHost: async () => ({ hostname: "ip-a1b2c3d4.co08.art", ip: "208.72.218.153", managementId: "u-demo", managementProof: "proof-demo" }) }));
import { createBootstrapRouter } from "./bootstrapRoutes";

describe("bootstrap management identity", () => { it("returns management id and signed proof", async () => { const app = express(); app.use(express.json()); app.use("/api/bootstrap", createBootstrapRouter()); const server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); const response = await fetch(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api/bootstrap/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "boot-demo", ip: "208.72.218.153", user: "root", port: 22 }) }); const body = await response.json(); server.close(); expect(response.status).toBe(201); expect(body).toMatchObject({ management_id: "u-demo", management_proof: "proof-demo" }); }); });
