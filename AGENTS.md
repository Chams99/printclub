# PhotoPrinting agent guide

## Product goal

PhotoPrinting is an English-language, premium editorial print shop and design studio. Customers can explore printable products, create a design, save or share it, export a production preview, and submit a clearly labelled demo order request. Staff can review those requests. Do not invent prices, delivery times, testimonials, partner relationships, or production claims.

## Source of truth and scope

- This repository uses TanStack Start (not Next.js), React 19, TypeScript strict mode, Vite, Tailwind CSS 4, shadcn/base-ui primitives, tRPC, Elysia, Better Auth, PostgreSQL, Drizzle, and Bun 1.3.14.
- Keep the existing monorepo boundaries: `apps/web` owns routes and browser UI; `apps/server` owns the HTTP server; `packages/api` owns typed procedures and domain contracts; `packages/db` owns schema and migrations; `packages/auth` owns authentication; `packages/ui` owns reusable primitives and tokens.
- Preserve unrelated working-tree edits. Inspect `git status --short` before editing. Never reset, checkout, or overwrite user changes.
- Do not silently migrate to Next.js, React Server Components, a hosted commerce platform, or a new deployment provider.

## Architecture rules

- TanStack Start code is isomorphic by default. Put server-only reads, writes, secrets, storage clients, and authorization in `createServerFn`, server routes, or `apps/server`; enforce authorization on the server even when a route also redirects in `beforeLoad`.
- Group server behavior by feature: catalog, assets, projects, exports, orders, collaboration, and staff. Keep request validation at the transport boundary and business rules in testable services.
- Use one versioned `DesignDocument` contract. Store application state, not canvas implementation objects. Approved revisions are immutable and are the only input to exports and order requests.
- Keep UI state such as selection, dialogs, zoom, and panel state outside the shared design document. Autosave must be debounced, retryable, and recoverable.
- Use direct package imports and declare dependencies in the package that uses them. Root scripts delegate to `turbo run`; package scripts contain task logic.

## Uploads, exports, and orders

- Accept JPEG, PNG, and WebP only after validating the file signature, decoded dimensions, size, ownership, and resource limits. Never trust the browser MIME type or original filename.
- Keep originals private. Use generated object keys and short-lived access URLs. Strip unnecessary metadata from derivatives and provide cleanup for abandoned assets.
- Calculate effective resolution after crop and scale. Show an actionable quality warning before order submission.
- Make export jobs idempotent and bounded. Render from the immutable revision with the same fonts and scene rules used by the editor.
- The current storefront uses demo order requests. Do not add real payment, fulfillment, or delivery promises without a confirmed provider and explicit configuration.

## Security and accessibility

- Keep secrets out of `PUBLIC_`/`VITE_` variables and browser bundles. Use Better Auth trusted origins, secure cookies, rate limits, session revocation, and server-side ownership checks.
- Password accounts require email verification. Keep the Resend API key server-only, send verification links through the configured provider, and require users to authenticate before linking another provider.
- Treat shared links as revocable capabilities with explicit permissions and expiry. Staff actions require a server-side staff role.
- Use semantic HTML, labels, keyboard alternatives for canvas gestures, visible `:focus-visible` states, 44px touch targets where practical, and `aria-live` for async status. Respect reduced motion and never disable zoom.
- Avoid `transition: all`, fabricated claims, unlabelled icon buttons, gesture-only actions, and fixed-height text that truncates French or long user content.

## Verification

Run from the repository root:

```text
bun install --frozen-lockfile
bun run check-types
bun run build
bun run test
```

Biome is currently configured as a read-only review with existing formatting debt; do not claim it passes unless it does. For UI changes verify direct load, client navigation, keyboard operation, reduced motion, 320px overflow, 200% zoom, and 390/768/1440px layouts. For editor changes test crop geometry, grouped undo/redo, reload recovery, missing assets, export output, and duplicate order submissions.

## Current guidance baseline

This file records practices verified on 2026-09-19 from the installed TanStack Start skill, Turborepo 2.x, Elysia 1.4.x, Better Auth 1.7.x, shadcn/base-ui, Vercel React/Web Interface guidance, OWASP upload guidance, and official Konva serialization guidance. Re-check upstream documentation when upgrading dependencies. Do not describe speculative 2027 practices as current facts.
