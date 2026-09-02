import { describe, expect, it } from "vitest";

describe("Cloudflare configuration", () => {
  it("can authenticate against the configured zone without exposing the token", async () => {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    const domain = process.env.DOMAIN || "co08.art";

    expect(token, "CLOUDFLARE_API_TOKEN must be configured").toBeTruthy();
    expect(zoneId, "CLOUDFLARE_ZONE_ID must be configured").toBeTruthy();

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const body = (await response.json()) as {
      success?: boolean;
      result?: { name?: string };
      errors?: Array<{ message?: string }>;
    };

    expect(response.ok, body.errors?.[0]?.message || "Cloudflare request failed").toBe(true);
    expect(body.success).toBe(true);
    expect(body.result?.name).toBe(domain);
  }, 15000);
});
