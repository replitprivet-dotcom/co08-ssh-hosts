import { afterEach, describe, expect, it, vi } from "vitest";
import { createARecord } from "./cloudflare";

afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare DNS safety", () => {
  it("creates a direct A record and never enables the HTTP proxy", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ type: "A", name: "vps-ab12cd34.co08.art", content: "208.72.218.153", ttl: 300, proxied: false });
      return new Response(JSON.stringify({ success: true, result: { id: "record-1", ...body } }), { status: 200 });
    }));
    const result = await createARecord("vps-ab12cd34.co08.art", "208.72.218.153", 300);
    expect(result.id).toBe("record-1");
  });
  it("rejects hostnames outside the configured zone", async () => {
    await expect(createARecord("elsewhere.example", "208.72.218.153", 300)).rejects.toThrow("outside the configured DNS zone");
  });
});
