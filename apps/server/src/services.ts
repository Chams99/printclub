import { createAuth } from "@PhotoPrinting/auth";
import { createDb } from "@PhotoPrinting/db";

import { sendVerificationEmail } from "./email";
import { ENV } from "./env.server";
import {
	createRateLimitGuard,
	createVerificationEmailGuard,
	parseTrustedProxyIps,
} from "./rate-limit";

export const db = createDb(ENV);
const trustedProxyIps = parseTrustedProxyIps(ENV.TRUSTED_PROXY_IPS);
const verificationEmailGuard = createVerificationEmailGuard({
	database: db,
	persistent: ENV.NODE_ENV === "production",
});
export const auth = createAuth(
	{
		...ENV,
		TRUSTED_PROXY_IPS: trustedProxyIps,
		sendVerificationEmail: async ({ user, url }) => {
			const limit = await verificationEmailGuard(user.email);
			if (!limit.allowed) {
				// Do not report a successful signup when the delivery guard has
				// deliberately suppressed the message. The client can then offer a
				// truthful retry state instead of leaving the user waiting for mail.
				throw new Error("Verification email temporarily unavailable");
			}
			await sendVerificationEmail({
				to: user.email,
				name: user.name,
				url,
			});
		},
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
