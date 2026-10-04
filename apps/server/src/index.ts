import { appRouter } from "@PhotoPrinting/api/routers/index";
import { cors } from "@elysiajs/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia } from "elysia";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { publicServerErrorHandler } from "./public-error";
import { getClientIp, parseTrustedProxyIps } from "./rate-limit";
import { handleResendWebhook } from "./resend-webhook";
import { auth, edgeRateLimitGuard } from "./services";
import { verifyTurnstileForRequest } from "./turnstile";

const maxRequestBodyBytes = 2 * 1024 * 1024;
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
	throw new Error("PORT must be an integer between 1 and 65535");
}

new Elysia()
	.use(
		cors({
			origin: ENV.CORS_ORIGIN,
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: [
				"Content-Type",
				"Authorization",
				"X-Printclub-Turnstile",
			],
			exposeHeaders: ["Retry-After", "RateLimit-Limit"],
			credentials: true,
		}),
	)
	.onRequest(async ({ request, server, set, status }) => {
		const contentLength = Number(request.headers.get("content-length") ?? 0);
		if (Number.isFinite(contentLength) && contentLength > maxRequestBodyBytes) {
			return status(413);
		}

		if (request.method === "OPTIONS") return;

		const isRead = request.method === "GET";
		const windowMs = 10_000;
		const max = isRead ? 120 : 30;
		const clientIp = getClientIp({
			request,
			server,
			trustedProxyIps: parseTrustedProxyIps(ENV.TRUSTED_PROXY_IPS),
		});
		const result = await edgeRateLimitGuard({
			key: `edge:${isRead ? "read" : "write"}:${clientIp}`,
			windowMs,
			max,
		});
		set.headers["RateLimit-Limit"] = String(max);
		if (!result.allowed) {
			set.headers["Retry-After"] = String(result.retryAfterSeconds);
			return status(429);
		}
	})
	.onAfterHandle(({ request, set }) => {
		set.headers["X-Content-Type-Options"] = "nosniff";
		set.headers["X-Frame-Options"] = "DENY";
		set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
		set.headers["Permissions-Policy"] =
			"camera=(), microphone=(), geolocation=()";
		if (
			ENV.NODE_ENV === "production" &&
			new URL(request.url).protocol === "https:"
		) {
			set.headers["Strict-Transport-Security"] =
				"max-age=31536000; includeSubDomains";
		}
	})
	.onError(publicServerErrorHandler)
	.post("/webhooks/resend", ({ request }) => handleResendWebhook(request))
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			const turnstile = await verifyTurnstileForRequest(request);
			if (!turnstile.allowed) {
				return new Response(
					JSON.stringify({
						code: "SECURITY_CHECK_REQUIRED",
						message: "Complete the security check and try again.",
					}),
					{
						status: 403,
						headers: { "content-type": "application/json" },
					},
				);
			}
			return auth.handler(request);
		}
		return status(405);
	})
	.all("/trpc/*", async (context) => {
		const res = await fetchRequestHandler({
			endpoint: "/trpc",
			router: appRouter,
			req: context.request,
			createContext: () => createContext({ context }),
			onError: ({ error, path, type }) => {
				if (error.code === "INTERNAL_SERVER_ERROR") {
					console.error("[tRPC] Unexpected request failure", {
						code: error.code,
						path,
						type,
					});
				}
			},
		});
		return res;
	})
	.get("/health", () => ({ status: "ok" }))
	.get("/", () => "OK")
	.listen({ hostname, port }, () => {
		console.log(`Server is running on http://${hostname}:${port}`);
	});
