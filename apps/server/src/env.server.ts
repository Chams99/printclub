import type { CoercedEnvSchema } from "./env";

const nodeEnv = process.env.NODE_ENV ?? "development";

if (!(["development", "production", "test"] as string[]).includes(nodeEnv)) {
	throw new Error("NODE_ENV must be development, production, or test");
}

function required(name: string): string {
	const value = process.env[name];

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
}

function requiredUrl(
	name: string,
	options: { httpsInProduction?: boolean } = {},
) {
	const value = required(name);
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid URL`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`${name} must use http or https`);
	}
	if (
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.pathname !== "/"
	) {
		throw new Error(`${name} must contain only an origin`);
	}
	if (
		options.httpsInProduction &&
		nodeEnv === "production" &&
		url.protocol !== "https:"
	) {
		throw new Error(`${name} must use HTTPS in production`);
	}
	return url.origin;
}

function requiredSecret(name: string): string {
	const value = required(name);
	if (value.length < 32) {
		throw new Error(`${name} must be at least 32 characters long`);
	}
	if (
		nodeEnv === "production" &&
		(/\s/.test(value) || new Set(value).size < 12)
	) {
		throw new Error(`${name} must be a high-entropy value in production`);
	}
	if (
		nodeEnv === "production" &&
		/^(change[-_ ]?me|replace[-_ ]?me|secret|password)$/i.test(value)
	) {
		throw new Error(`${name} must not use a placeholder value in production`);
	}
	return value;
}

if (
	nodeEnv === "production" &&
	(!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
) {
	throw new Error(
		"RESEND_API_KEY and EMAIL_FROM are required in production for email verification",
	);
}

export const ENV = {
	NODE_ENV: nodeEnv as CoercedEnvSchema["NODE_ENV"],
	BETTER_AUTH_SECRET: requiredSecret("BETTER_AUTH_SECRET"),
	BETTER_AUTH_URL: requiredUrl("BETTER_AUTH_URL", { httpsInProduction: true }),
	CORS_ORIGIN: requiredUrl("CORS_ORIGIN", { httpsInProduction: true }),
	TRUSTED_PROXY_IPS: process.env.TRUSTED_PROXY_IPS,
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	RESEND_API_KEY: process.env.RESEND_API_KEY,
	EMAIL_FROM: process.env.EMAIL_FROM,
	DATABASE_URL: required("DATABASE_URL"),
} satisfies CoercedEnvSchema;
