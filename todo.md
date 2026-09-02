# Project TODO

- [x] Configure secure Cloudflare environment variables: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, and DOMAIN with co08.art default.
- [x] Add persistent models for API keys, hosts, DNS records, audit logs, and scheduled-cleanup ownership metadata.
- [x] Add database helpers for host statistics, host CRUD, API-key management, DNS records, and audit logs.
- [x] Implement server-side Cloudflare DNS client with zone scoping, token secrecy, DNS-only records, configurable TTL, and safe error handling.
- [x] Implement cryptographically secure unique hostname generation under the configured co08.art zone.
- [x] Implement protected dashboard procedures for statistics, recent activity, host listing, creation, renewal, deletion, and Cloudflare connection testing.
- [x] Implement versioned REST API endpoints: POST /api/v1/hosts, GET /api/v1/hosts, DELETE /api/v1/hosts/:id, POST /api/v1/hosts/:id/renew, and public GET /health.
- [x] Implement API-key issuance, hashed-at-rest storage, revocation, quotas, request authentication, rate limiting, and request logging.
- [x] Implement scheduled expired-host cleanup through the platform callback path without in-process timers.
- [x] Implement audit logging for every DNS create/delete operation and security-relevant API action.
- [x] Build the dark responsive dashboard shell with sidebar navigation and authenticated state handling.
- [x] Build the overview dashboard with total, active, expired, expiring-soon, and API-request metrics plus recent activity.
- [x] Build the Create SSH Host workflow with IPv4 validation, TTL, expiration, copyable hostname, and copyable SSH command.
- [ ] Build the host management table with status, expiration, copy actions, renewal, and confirmed deletion.
- [x] Build API Keys management with create-once secret display, quota visibility, and revoke controls.
- [x] Build Activity Logs and Settings pages with non-secret Cloudflare/domain connection status.
- [x] Add responsive mobile navigation, accessibility states, and polished operational empty/loading/error states.
- [x] Add unit tests covering validation, secure hostname generation, Cloudflare payload proxied=false, API-key hashing/authentication, rate limits, and expiration behavior.
- [x] Add complete README.md, config.example.txt, migration/setup guidance, Ubuntu 24.04 deployment instructions, reverse proxy/HTTPS guidance, and Cloudflare least-privilege token instructions.
- [x] Run type checks, tests, build, and visual responsive verification.
- [x] Re-review this TODO and mark every completed item before the final checkpoint.

## Follow-up corrections

- [x] Add scheduled-cleanup task metadata to the schema and document persistence of the Heartbeat task UID.
- [x] Enforce hostname uniqueness with database collision checks and retry generation before Cloudflare creation.
- [x] Fix API rate limiting with a real time window and log all API requests and authentication outcomes.
- [x] Add ownership checks to host renewal and every id-based mutation.
- [x] Add API-request metrics to the overview dashboard.
- [x] Show a post-create result panel with copyable hostname and SSH command.
- [ ] Convert host inventory to a true table, add copy-hostname action, and require confirmed deletion everywhere.
- [ ] Add tests for API-key authentication and expiration cleanup behavior; rate-window behavior is covered.
- [x] Add a non-secret configuration example under a filename permitted by tooling.
- [x] Re-review todo completion status before the final checkpoint.

## Final security corrections

- [x] Increment and persist API-key request counters for every authenticated REST endpoint.
- [x] Log authentication outcomes explicitly for missing, invalid, revoked, quota-rejected, and rate-limited API requests.
- [ ] Add tests for API-key authentication and expiration cleanup behavior.
- [ ] Re-review todo completion after the API security corrections are complete.
