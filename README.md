# CO08 / CONTROL

CO08 / CONTROL is a full-stack operations dashboard for creating and retiring temporary, DNS-only SSH hostnames under `co08.art`. It manages DNS records only. It never opens an SSH session, executes a shell command, or exposes a terminal.

## Architecture

The application uses the project’s React + Tailwind + Express + tRPC + Drizzle stack. Browser users authenticate through the built-in OAuth flow. Cloudflare credentials are read only by server code. Every generated record is an individual `A` record with `proxied: false`, and every create, delete, renewal, expiration, and API-key action is written to the audit log.

| Surface | Purpose |
| --- | --- |
| Dashboard | Authenticated overview, host inventory, API keys, activity, and configuration health |
| tRPC | Typed dashboard operations for authenticated users |
| REST v1 | API-key-protected command-line VPS workflow |
| Cloudflare client | Zone-scoped server-side DNS automation |
| Heartbeat callback | Platform-managed expired-host cleanup at `/api/scheduled/cleanup-expired` |

## Configuration

See `config.example.txt` for a non-secret configuration template. Set the following server environment variables through the project’s secure Secrets settings. Do not commit a `.env` file or place the token in frontend code.

```env
CLOUDFLARE_API_TOKEN=replace_with_a_zone_scoped_token
CLOUDFLARE_ZONE_ID=replace_with_the_co08_art_zone_id
DOMAIN=co08.art
```

The Cloudflare token should be created with the narrowest available scope: **Zone → DNS → Edit**, restricted to the single `co08.art` zone. The zone ID is shown on the zone Overview page in Cloudflare. The Settings page displays only connection status, domain, and non-secret configuration health.

## Local development

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
```

The application requires the managed database connection supplied by the full-stack project. The migration in `drizzle/0001_amazing_stature.sql` creates `api_keys`, `hosts`, `dns_records`, and `audit_logs` alongside the existing `users` table. The TypeScript schema remains portable to a PostgreSQL migration path, although this template currently uses its MySQL-compatible Drizzle adapter.

## REST API

Issue an API key from the **API access** page. The complete secret is displayed once and is stored only as a SHA-256 hash. Store it in a password manager or VPS secret store.

Create a hostname:

```bash
curl -X POST https://co08.art/api/v1/hosts \
  -H "Authorization: Bearer co08_REPLACE_ME" \
  -H "Content-Type: application/json" \
  -d '{"ip":"208.72.218.153","ttl":300,"expires_in":86400}'
```

The response contains `hostname`, `ssh_command`, `ip`, `expires_at`, and `status`. List hosts with `GET /api/v1/hosts`, delete with `DELETE /api/v1/hosts/{id}`, and renew with `POST /api/v1/hosts/{id}/renew` using a JSON body such as `{"expires_in":86400}`. All versioned endpoints require a valid API key, enforce per-key host quotas, enforce request limits, validate public IPv4 input, and write request-relevant audit entries.

`GET /health` is intentionally public and returns `{ "status": "ok" }`. No endpoint executes SSH or shell commands.

## Automatic expiration

Expiration cleanup is implemented as an idempotent platform-managed HTTP callback. It is deliberately not implemented with `setInterval` or an in-process timer because autoscaled instances can stop between requests. After the project is deployed once, create a daily Heartbeat job from a terminal associated with this project:

```bash
manus-heartbeat create \
  --name cleanup-expired-hosts \
  --cron "0 0 * * * *" \
  --path /api/scheduled/cleanup-expired \
  --description "Delete expired co08.art DNS records"
```

The callback accepts only a cron-authenticated request, finds expired rows from the database, deletes their Cloudflare records, marks them expired, and records the operation. Because scheduling requires the deployed site URL, deploy the checkpoint first and then create the job.

## Ubuntu 24.04 deployment

A straightforward production path is to build the project on the VPS or through the managed deployment flow, provide the database URL and secure Cloudflare secrets, and serve it behind HTTPS. For a standalone Ubuntu service, install Node.js 22 and a MySQL-compatible database, then run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
NODE_ENV=production pnpm start
```

Use a reverse proxy such as Nginx or Caddy to terminate HTTPS for `co08.art`, proxy requests to the Node process, and configure automatic certificate renewal. Set the process manager to restart on failure. Do not expose the Node port directly to the public internet. Ensure Cloudflare DNS for `co08.art` points the web application hostname to the web server, while generated SSH aliases remain separate individual DNS-only records.

## Security checklist

Confirm that the Cloudflare token is absent from browser bundles and JSON responses, that the token is restricted to DNS edits for the `co08.art` zone, and that every DNS create request includes `proxied: false`. Keep API keys hashed at rest, rotate and revoke keys when a VPS is retired, use HTTPS, retain audit logs, keep host quotas conservative, and avoid accepting arbitrary record names. The application’s DNS helper also rejects hostnames outside the configured domain.

## Validation checklist

Run `pnpm check` and `pnpm test`. In a configured environment, create a test hostname for `208.72.218.153`, inspect the Cloudflare record to confirm it is an `A` record with `proxied=false`, verify the hostname resolves directly to the IP, delete it from the dashboard, exercise API-key authentication and rate limits, renew a short-lived host, run the scheduled cleanup callback, and verify the responsive layout at desktop and mobile widths.
