import type { Database } from "@PhotoPrinting/db";
import * as schema from "@PhotoPrinting/db/schema/auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";

export type AuthConfig = {
	NODE_ENV?: "development" | "production" | "test";
	BETTER_AUTH_URL: string;
	BETTER_AUTH_SECRET: string;
	CORS_ORIGIN: string;
	TRUSTED_PROXY_IPS?: readonly string[];
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	sendVerificationEmail: (
		input: {
			user: { email: string; name: string };
			url: string;
			token: string;
		},
		request?: Request,
	) => Promise<void> | void;
};

export function createAuth(
	env: AuthConfig,
	database: Database,
	desktopOrigins: readonly string[] = [],
) {
	const isProduction = env.NODE_ENV === "production";
	const secureCookies =
		isProduction || env.BETTER_AUTH_URL.startsWith("https://");
	return betterAuth({
		database: drizzleAdapter(database, {
			provider: "pg",
			schema,
		}),
		trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			minPasswordLength: 8,
			maxPasswordLength: 128,
		},
		emailVerification: {
			sendVerificationEmail: async ({ user, url, token }, request) => {
				await env.sendVerificationEmail({ user, url, token }, request);
			},
			sendOnSignUp: true,
			sendOnSignIn: true,
			autoSignInAfterVerification: true,
			expiresIn: 60 * 60,
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		rateLimit: {
			enabled: env.NODE_ENV !== "test",
			// Memory is convenient for local development; production uses the
			// shared Postgres bucket so limits survive restarts and replicas.
			storage: isProduction ? "database" : "memory",
			window: 10,
			max: 100,
			customRules: {
				"/sign-in/email": { window: 60, max: 5 },
				"/sign-up/email": { window: 60, max: 3 },
				"/send-verification-email": { window: 60, max: 5 },
				"/callback/*": { window: 60, max: 10 },
			},
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24,
			freshAge: 60 * 60,
		},
		account: {
			encryptOAuthTokens: true,
			accountLinking: {
				enabled: true,
				disableImplicitLinking: true,
				trustedProviders: ["google"],
				allowDifferentEmails: false,
			},
		},
		advanced: {
			disableCSRFCheck: false,
			useSecureCookies: secureCookies,
			...(env.TRUSTED_PROXY_IPS?.length
				? {
						ipAddress: {
							ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
							trustedProxies: [...env.TRUSTED_PROXY_IPS],
							ipv6Subnet: 64,
						},
					}
				: {}),
			defaultCookieAttributes: {
				sameSite: "lax",
				secure: secureCookies,
				httpOnly: true,
			},
		},
		...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					socialProviders: {
						google: {
							clientId: env.GOOGLE_CLIENT_ID,
							clientSecret: env.GOOGLE_CLIENT_SECRET,
						},
					},
				}
			: {}),
		plugins: [],
	});
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
