import { ENV } from "./_core/env";

const API_BASE = "https://api.cloudflare.com/client/v4";

type CloudflareResponse<T> = { success: boolean; result: T; errors?: Array<{ message?: string }> };

function assertConfigured() {
  if (!ENV.cloudflareApiToken || !ENV.cloudflareZoneId) {
    throw new Error("Cloudflare credentials are not configured");
  }
}

async function cf<T>(path: string, init: RequestInit = {}) {
  assertConfigured();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ENV.cloudflareApiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const body = (await response.json()) as CloudflareResponse<T>;
  if (!response.ok || !body.success) {
    throw new Error(body.errors?.[0]?.message || "Cloudflare API request failed");
  }
  return body.result;
}

export function assertHostnameInZone(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (!normalized.endsWith(`.${ENV.domain}`) || normalized === ENV.domain) {
    throw new Error("Hostname is outside the configured DNS zone");
  }
  return normalized;
}

export async function testCloudflareConnection() {
  const result = await cf<{ name: string }>(`/zones/${ENV.cloudflareZoneId}`);
  if (result.name.toLowerCase() !== ENV.domain) throw new Error("Configured zone does not match DOMAIN");
  return { connected: true, domain: result.name, zoneId: ENV.cloudflareZoneId };
}

export async function createARecord(hostname: string, ip: string, ttl: number) {
  const name = assertHostnameInZone(hostname);
  return cf<{ id: string; name: string; content: string; ttl: number; proxied: boolean }>(`/zones/${ENV.cloudflareZoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({ type: "A", name, content: ip, ttl, proxied: false }),
  });
}

export async function deleteDnsRecord(recordId: string) {
  return cf<{ id: string }>(`/zones/${ENV.cloudflareZoneId}/dns_records/${recordId}`, { method: "DELETE" });
}
