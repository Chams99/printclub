# printclub VPS deployment

This deployment runs printclub beside the portfolio through the existing external
Docker network named `traefik`:

- `https://printclub.chames.tn` → the TanStack Start web container
- `https://api.printclub.chames.tn` → the Elysia API container
- PostgreSQL stays on printclub’s private Docker network and has no host port

The deployment is for the portfolio demo. It does not add payments, fulfillment,
cloud project storage, production exports, or a public staff console. `/staff` is
disabled in production until server-side staff roles and audit logging exist.

## First deployment

## Existing Dokploy deployment

For the restored Dokploy application, keep the existing `printclub` app record
and use the tracked `deploy/dokploy-production.compose.yml` when configuring
its Git source.
The Compose file builds the API and web services from this repository while
keeping PostgreSQL in its existing, separate Dokploy record. It uses the
root-owned runtime file at `/etc/dokploy/private-runtime/printclub/api.runtime.env`
for API settings and the existing `printclub_internal` and `dokploy-network`
networks. Do not run the standalone `deploy/compose.yml` against that project:
it also declares a PostgreSQL container and migration service.

Set the existing public web build values in Dokploy Compose variables before
building: `VITE_SERVER_URL`, `VITE_GOOGLE_CLIENT_ID`, and
`VITE_TURNSTILE_SITE_KEY`. `VITE_SERVER_URL` must be
`https://api.printclub.chames.tn`; the client ID and Turnstile site key are
public build-time values, not server secrets. Keep API credentials only in the
private runtime file. Leave Auto Deploy off during a controlled source switch,
verify both health routes and strict-TLS public routes, and retain the prior
Raw Compose configuration and images for rollback.

The standalone first-deployment instructions below remain for a separate
self-managed Docker installation.

On the VPS, clone the repository and make sure the existing Traefik network is
present:

```bash
docker network inspect traefik >/dev/null
```

Create the deployment environment file and use unique values:

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

Set `TRUSTED_PROXY_IPS` to the actual Traefik Docker network CIDR. Generate
`BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD` with a password manager or a
cryptographically secure generator. The production Google OAuth client must list:

```text
https://printclub.chames.tn
https://api.printclub.chames.tn/api/auth/callback/google
```

Email/password accounts require verification before sign-in. Create a Resend
API key, verify the sending domain, and set `RESEND_API_KEY` plus a matching
`EMAIL_FROM` address in `deploy/.env`. The API key is server-only. Verification
mail is also capped at one message per address every 5 minutes, five per
address per day, and 80 messages globally per day.

For bot protection, create a Cloudflare Turnstile widget for the production
hostname and set both `VITE_TURNSTILE_SITE_KEY` (public, used during the web
build) and `TURNSTILE_SECRET_KEY` (server-only). Set
`TURNSTILE_EXPECTED_HOSTNAMES=printclub.chames.tn` so tokens issued for another
site are rejected. If the keys are empty, the demo keeps the existing rate
limits without requiring a challenge.

To suppress addresses after permanent bounces, create a Resend webhook for
`https://api.printclub.chames.tn/webhooks/resend`, subscribe to
`email.bounced`, copy its `whsec_...` signing secret into
`RESEND_WEBHOOK_SECRET`, and redeploy. The handler verifies the Svix signature,
stores only a SHA-256 email hash, and blocks later verification messages for
that address. It accepts no unsigned or stale webhook payloads.

If a Traefik CSP is configured, allow the Turnstile origins in addition to the
existing sources: `https://challenges.cloudflare.com` in `script-src`,
`frame-src`, and `connect-src`.

Deploy from the repository root:

```bash
bash deploy/deploy.sh
```

The script builds the web and API images, starts PostgreSQL privately, applies
Drizzle migrations, and waits for both application health checks before returning.

## Backups and restore

Create a compressed database backup before upgrades:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T postgres \
  pg_dump -U printclub -d printclub --format=custom > "printclub-$(date +%Y%m%d-%H%M%S).dump"
```

Restore only during a planned maintenance window:

```bash
cat backup.dump | docker compose --env-file deploy/.env -f deploy/compose.yml exec -T postgres \
  pg_restore -U printclub -d printclub --clean --if-exists --no-owner
```

Verify backups by restoring into a separate database before relying on them.

## Operational checks

```bash
docker compose --env-file deploy/.env -f deploy/compose.yml ps
docker compose --env-file deploy/.env -f deploy/compose.yml logs --tail 100 api web
curl -fsS https://api.printclub.chames.tn/health
curl -fsS https://printclub.chames.tn/health
```

Do not publish PostgreSQL’s port, commit `deploy/.env`, or expose the API with a
different origin than the one configured in `CORS_ORIGIN` and Better Auth.
