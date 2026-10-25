# PhotoPrinting

PhotoPrinting is a print-shop and design-studio demo built with [TanStack Start](https://tanstack.com/start), React, Motion, Elysia, tRPC, Drizzle, PostgreSQL, and Better Auth. It demonstrates a complete demo flow for browsing products, editing and exporting designs in the browser, and submitting a clearly labelled sample request. A real print partner and payment provider are not connected.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Elysia** - Type-safe, high-performance framework
- **tRPC** - End-to-end type-safe APIs
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Biome** - Linting and formatting
- **Turborepo** - Optimized monorepo build system

## Product workflow

The storefront at `/` introduces five printable formats with original WebP demo photography, template filters, an interactive format gallery, a scroll-led photo story, an FAQ, footer navigation, and reduced-motion fallbacks. `/formats/:productId` provides a product detail view and `/templates` provides editable starting points. `/studio` is a guest-first design surface where a visitor can upload a JPEG, PNG, or WebP, add text and shapes, move and crop layers, change the canvas, undo/redo, recover a saved design, and download an SVG preview. Photos and editable drafts stay in the current browser. The request form submits a clearly labelled demo request to the API and saves its returned reference in this browser; it does not create an offline request if the API is unavailable. The server does not store a review queue or send email.

`/orders` lists requests saved in the current browser. `/staff` is a local-only operations preview and must be replaced with a server-authorized staff route before production use. Cloud projects, private object storage, image processing, live collaboration, payments, and fulfillment are planned follow-up milestones.

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## VPS deployment

The repository includes a Docker Compose deployment for running printclub beside the existing portfolio on the same Traefik network. It keeps PostgreSQL private, runs reviewed Drizzle migrations before the API starts, exposes `/health` checks for both services, and publishes separate hosts:

- Web: `https://printclub.chames.tn`
- API: `https://api.printclub.chames.tn`

On the VPS, make sure the existing external `traefik` network is present, then configure the deployment environment and run the checked-in script:

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
# Fill deploy/.env with unique production secrets and the Traefik proxy CIDR.
bash deploy/deploy.sh
```

The full topology, Google OAuth callback, backup/restore commands, health checks, and demo limitations are documented in [`deploy/README.md`](deploy/README.md). The production image intentionally keeps `/staff` disabled because the current staff screen is browser-local and is not yet backed by server-enforced roles and audit logging.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@PhotoPrinting/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `bun run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

Bun's automatic env loading is disabled in `bunfig.toml`; the server scripts pass `apps/server/.env` explicitly. The server validates the auth URL, CORS origin, and secret at startup. Production requires HTTPS and a unique high-entropy `BETTER_AUTH_SECRET` of at least 32 characters. When a reverse proxy forwards client addresses, set `TRUSTED_PROXY_IPS` to its comma-separated IPs/CIDRs so auth rate limits are per client instead of one shared bucket. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

Google sign-in is optional. To enable the button on `/login`, set `VITE_GOOGLE_CLIENT_ID` in `apps/web/.env`, and set the matching `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `apps/server/.env`. Add the Better Auth callback URL (`{BETTER_AUTH_URL}/api/auth/callback/google`) to the Google OAuth client before testing. Keep the client secret server-only; never add it to a `VITE_` variable.

Email/password accounts require verification before sign-in. Production needs a transactional email provider; the deployment template uses Resend through `RESEND_API_KEY` and `EMAIL_FROM`. The API key remains server-only.

## Git Hooks and Formatting

- Run checks: `bun run check`

## Project Structure

```
PhotoPrinting/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Start)
│   └── server/      # Backend API (Elysia, TRPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run test`: Run domain tests with Bun
- `bun run check`: Run the read-only Biome review (existing starter debt may remain)
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI
- `bun run check`: Run Biome formatting and linting

## Better Auth Schema Generation

After changing auth plugins or schema options, run `bun run auth:generate` from the project root. The script runs the Better Auth CLI through `varlock run` from the owning app directory, loading the auth instance from `src/services.ts`. Review the schema changes, then use your ORM's migration workflow to apply them.

## Abuse controls

Production authentication rate limits use the shared PostgreSQL `rate_limit` table so limits survive restarts and are consistent across server replicas. Apply the database migrations before deploying the server. The API also applies a bounded per-IP request guard, a 2 MiB request-body limit, and per-user/per-IP limits for demo requests. Verification mail adds a hashed per-address cooldown of one message per 5 minutes, a five-message daily limit per address, and an 80-message global daily cap. Permanent Resend bounces can be signed into a hashed suppression table so later verification messages are refused. These limits fail closed if the shared bucket cannot be written.

Set `TRUSTED_PROXY_IPS` to the addresses or CIDR ranges of the reverse proxy in front of the server. This allows the server to use the original client address safely; never populate it with arbitrary client-controlled values. Email verification is enforced for password accounts and requires the production Resend settings above. Turnstile is available for sign-up, sign-in, and verification-email requests when both production keys are configured; its token is always verified by the API. A WAF, bot monitoring, and shared edge storage remain launch requirements once real account creation is opened to the public.
