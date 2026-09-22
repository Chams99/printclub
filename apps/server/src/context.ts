import type { Context as ApiContext } from "@PhotoPrinting/api/context";
import type { Context as ElysiaContext } from "elysia";

import { ENV } from "./env.server";
import { getClientIp, parseTrustedProxyIps } from "./rate-limit";
import { auth, db, rateLimitGuard } from "./services";

export type CreateContextOptions = {
	context: ElysiaContext;
};

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.request.headers,
	});
	return {
		db,
		session,
		clientIp: getClientIp({
			request: context.request,
			server: context.server,
			trustedProxyIps: parseTrustedProxyIps(ENV.TRUSTED_PROXY_IPS),
		}),
		rateLimit: rateLimitGuard,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
