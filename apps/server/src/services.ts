import { createAuth } from "@PhotoPrinting/auth";
import { createDb } from "@PhotoPrinting/db";

import { sendVerificationEmail } from "./email";
import { ENV } from "./env.server";
import { createRateLimitGuard, parseTrustedProxyIps } from "./rate-limit";

export const db = createDb(ENV);
const trustedProxyIps = parseTrustedProxyIps(ENV.TRUSTED_PROXY_IPS);
export const auth = createAuth(
	{
		...ENV,
		TRUSTED_PROXY_IPS: trustedProxyIps,
		sendVerificationEmail: ({ user, url }) =>
			sendVerificationEmail({
				to: user.email,
				name: user.name,
				url,
			}),
	},
	db,
);
export const rateLimitGuard = createRateLimitGuard({
	database: db,
	persistent: ENV.NODE_ENV === "production",
});
export const edgeRateLimitGuard = createRateLimitGuard({
	database: db,
	persistent: false,
});
