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
- [x] Build the host management table with status, expiration, copy actions, renewal, and confirmed deletion.
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
- [x] Convert host inventory to a true table, add copy-hostname action, and require confirmed deletion everywhere.
- [x] Add tests for API-key authentication and expiration cleanup behavior; rate-window behavior is covered.
- [x] Add a non-secret configuration example under a filename permitted by tooling.
- [x] Re-review todo completion status before the final checkpoint.

## Final security corrections

- [x] Increment and persist API-key request counters for every authenticated REST endpoint.
- [x] Log authentication outcomes explicitly for missing, invalid, revoked, quota-rejected, and rate-limited API requests.
- [x] Add tests for API-key authentication and expiration cleanup behavior.
- [x] Re-review todo completion after the API security corrections are complete.

## Strict finalization

- [x] Replace the host inventory div grid with a real semantic HTML table containing Hostname, VPS IP, Created, Expires, Status, and Actions columns.
- [x] Add comprehensive API-key outcome tests and an expiration-cleanup flow test.
- [x] Re-review and update TODO completion only after strict finalization is complete.

## Strict test coverage

- [x] Add API-key authentication tests for invalid, revoked, quota-rejected, and rate-limited outcomes.
- [x] Add an expiration-cleanup flow test that verifies expired hosts are marked and audited.
- [x] Re-review and update TODO completion only after strict test coverage passes.

## VPS bootstrap onboarding

- [x] Add one-time bootstrap token persistence with expiry, single-use enforcement, hashing, and audit events.
- [x] Add protected endpoint to issue a bootstrap command and a public token exchange endpoint for VPS setup.
- [x] Ensure the bootstrap flow only creates DNS records through the existing Cloudflare API and never executes shell or SSH from the app.
- [x] Add a copyable VPS command/tutorial with prerequisites, expected output, SSH connection example, and failure recovery.
- [x] Add tests for token hashing, expiry, single-use behavior, command safety, and bootstrap API responses.
- [x] Update README with the VPS bootstrap workflow and security warnings.
- [x] Run type checks, tests, build, and save a new checkpoint.

## Bootstrap hardening

- [x] Generate bootstrap URLs from the current public request host instead of confusing the DNS zone with the app base URL.
- [x] Expand the dashboard bootstrap card with prerequisites, expected output, SSH example, and recovery guidance.
- [x] Add bootstrap-specific tests for token hashing, expiry, single-use behavior, safe command generation, and completion responses.
- [x] Re-run validation and review TODO completion before the next checkpoint.

## Bootstrap test completion

- [x] Test bootstrap token expiry and single-use consumption behavior.
- [x] Test bootstrap command generation uses the request host safely and not the DNS zone.
- [x] Test GET /api/bootstrap/:secret and POST /api/bootstrap/complete success and invalid-token responses.
- [x] Re-review Bootstrap hardening TODO statuses after these tests pass.

## Final bootstrap verification

- [x] Test true token expiry and first-consume/second-consume single-use behavior.
- [x] Add HTTP-level coverage for bootstrap script and completion endpoint success/error responses.
- [x] Re-review Bootstrap hardening TODO statuses after final verification.

## Vercel and GitHub CLI redesign

- [x] Define a Vercel-compatible deployment architecture and document required environment variables and Cloudflare DNS prerequisites.
- [x] Add a public co08.art command/tutorial landing page explaining the install and usage flow.
- [x] Build a versioned installable co08 CLI package with `co08 ssh`, user ID authentication, configurable SSH user/port, and no local SSH execution by the web app.
- [x] Add a CLI bootstrap/token exchange flow that safely provisions a DNS hostname and returns the SSH connection command.
- [x] Add user management IDs with authenticated status, stop/revoke, and hostname regeneration controls.
- [x] Add support for generated hostnames such as `ip-899ac5a0.co08.art` while enforcing zone scope and collision safety.
- [x] Add password/credential guidance without storing or exposing plaintext VPS passwords; support user-provided SSH key/password setup instructions safely.
- [x] Add Vercel configuration, deployment documentation, and GitHub repository metadata.
- [x] Run tests, build, create a private GitHub repository, push the project, and provide the Vercel setup steps.

## Final Vercel and CLI corrections

- [x] Add a public frontend command/tutorial landing page and route.
- [x] Define the CLI identity model clearly: use one-time bootstrap token for provisioning and a separate management ID for later controls, with tests.
- [x] Change generated hostname format to `ip-<random>.co08.art` and update tests.
- [x] Add concrete SSH key/password setup guidance without storing plaintext credentials.
- [x] Commit and push every post-repository change to GitHub.
- [x] Add Vercel-compatible serverless API entrypoints for health and bootstrap exchange; validate the handlers with the project build and tests.
- [x] Re-run tests, build, and review TODO completion before the next checkpoint.

## Final management security

- [x] Protect management status/stop/regenerate operations with a signed, expiring management proof rather than a bare identifier.
- [x] Add HTTP tests for management lookup, stop, regenerate, and CLI bootstrap-to-management identity flow.
- [x] Add explicit SSH public-key setup steps, optional password-login warning, and plaintext-secret handling guidance to the landing page and README.
- [x] Commit/push all changes, rerun validation, and complete the TODO review.

## Release evidence

- [x] Add successful HTTP coverage for management lookup, stop, and regenerate plus bootstrap response to management proof flow.
- [x] Mirror the explicit SSH key and password safety guidance in README.md.
- [x] Commit and push all final changes to GitHub.
- [x] Re-run validation after the final commit and complete the TODO review.

## Final release evidence

- [x] Assert `management_id` and `management_proof` in bootstrap completion tests.
- [x] Add explicit SSH public-key setup and temporary password-login warnings to README.md.
- [x] Commit and push the latest management, API, schema, UI, test, and documentation changes.
- [x] Re-run validation after the final push and complete the TODO review.

## Post-push verification

- [x] Re-run `pnpm check && pnpm test && pnpm build` after GitHub commit 56172c0 and record the successful result.
- [x] Complete the final TODO review after post-push validation.

## Public CLI repository

- [x] Change the GitHub repository visibility from private to public at the user's request.
- [x] Verify anonymous repository access and the public pip install URL with a clean virtual-environment smoke test.
- [x] Confirm no secrets or environment files are tracked before delivering the public link.

## Vercel production and CLI login

- [ ] Audit current Vercel project, deployment, domain, OAuth, and GitHub state.
- [ ] Add `co08 login` CLI command that creates a short-lived random pairing URL and polls for completion without opening SSH or executing shell commands.
- [ ] Add browser pairing page with GitHub/Google-compatible authentication path and one-time exchange protection.
- [ ] Issue a user-scoped CLI credential after successful browser login with revocation and expiry controls.
- [ ] Add easy automatic CLI onboarding and clear error/recovery states.
- [ ] Configure or verify Vercel production deployment and attach co08.art if account/DNS permissions allow.
- [ ] Request any mandatory GitHub/Google OAuth and production deployment secrets through the secure secret flow.
- [ ] Add tests for pairing URL entropy, expiry, replay prevention, login completion, and credential revocation.
- [ ] Run deployment validation, push final code to GitHub, and save a new checkpoint.

## Selected login architecture

- [ ] Use GitHub OAuth as the primary browser login provider with short-lived state and callback validation.
- [ ] Add `co08 login` pairing flow that displays a random URL, polls securely, and receives a revocable user-scoped CLI credential.
- [ ] Keep CLI credentials hashed at rest, scoped to the user, expiring/revocable, and never expose GitHub tokens to the CLI.
- [ ] Add GitHub OAuth secret requirements and callback URL documentation for Vercel.
- [ ] Add tests for OAuth state, pairing replay prevention, CLI credential issuance, and revocation.

## Vercel handoff

- [x] Verify the linked Vercel project remains production-ready and connected to the public repository.
- [x] Verify the public deployment URL and health/bootstrap route availability.
- [x] Document the exact user-side steps to add co08.art and configure required Vercel secrets.
- [x] Re-run final validation and save a Vercel handoff checkpoint.

## Vercel API release blocker

- [x] Fix Vercel routing so `/health` and `/api/*` serverless functions are deployed and reachable.
- [x] Redeploy and smoke-test the public health endpoint before calling Vercel production-ready; verified `/api/health` returns 200.

## Fresh Vercel verification

- [x] Push the `/health` rewrite and verify a fresh Vercel production deployment reaches READY.
- [x] Smoke-test live `/health`, `/api/health`, and a bootstrap API route after redeployment.
