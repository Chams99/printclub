import type { Database } from "@PhotoPrinting/db";
import { rateLimit } from "@PhotoPrinting/db/schema/auth";
import { createHash, randomUUID } from "node:crypto";
import { and, like, lt, or, sql } from "drizzle-orm";

type RateLimitInput = {
	key: string;
	windowMs: number;
	max: number;
};

export type RateLimitResult = {
	allowed: boolean;
	retryAfterSeconds: number;
};

function ipv4ToNumber(address: string): number | null {
	const parts = address.split(".");
	if (parts.length !== 4) return null;
	const octets = parts.map((part) => Number(part));
	if (
		octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
	) {
		return null;
	}
	const [first = 0, second = 0, third = 0, fourth = 0] = octets;
	return ((first << 24) | (second << 16) | (third << 8) | fourth) >>> 0;
}

function isTrustedProxy(
	address: string | undefined,
	trustedProxies: readonly string[],
) {
	if (!address) return false;
	return trustedProxies.some((entry) => {
		const [network = "", prefixText] = entry.split("/");
		if (!prefixText) return address === network;
		const addressNumber = ipv4ToNumber(address);
		const networkNumber = ipv4ToNumber(network);
		const prefix = Number(prefixText);
		if (
			addressNumber === null ||
			networkNumber === null ||
			!Number.isInteger(prefix) ||
			prefix < 0 ||
			prefix > 32
		) {
			return false;
		}
		const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
		return (addressNumber & mask) === (networkNumber & mask);
	});
}

const memoryBuckets = new Map<string, { count: number; lastRequest: number }>();
let nextDatabaseCleanupAt = 0;

function scheduleApplicationBucketCleanup(database: Database, now: number) {
	if (now < nextDatabaseCleanupAt) return;
	nextDatabaseCleanupAt = now + 15 * 60 * 1_000;
	void database
		.delete(rateLimit)
		.where(
			and(
				or(
					like(rateLimit.key, "demo-order:%"),
					like(rateLimit.key, "email-verification:%"),
				),
				lt(rateLimit.lastRequest, now - 24 * 60 * 60 * 1_000),
			),
		)
		.catch((error: unknown) => {
			console.error("Could not prune application rate-limit buckets", error);
		});
}

function consumeMemory(input: RateLimitInput): RateLimitResult {
	const now = Date.now();
	const bucket = memoryBuckets.get(input.key);
	const isExpired = !bucket || now - bucket.lastRequest >= input.windowMs;
	const next = isExpired
		? { count: 1, lastRequest: now }
		: { count: bucket.count + 1, lastRequest: now };
	memoryBuckets.set(input.key, next);

	// Keep an attacker from turning the process-local fallback into a memory leak.
	if (memoryBuckets.size > 10_000) {
		for (const [key, value] of memoryBuckets) {
			if (now - value.lastRequest >= input.windowMs) memoryBuckets.delete(key);
			if (memoryBuckets.size <= 8_000) break;
		}
	}

	return {
		allowed: next.count <= input.max,
		retryAfterSeconds: Math.max(
			1,
			Math.ceil((next.lastRequest + input.windowMs - now) / 1_000),
		),
	};
}

async function consumeDatabase(
	database: Database,
	input: RateLimitInput,
): Promise<RateLimitResult> {
	const now = Date.now();
	scheduleApplicationBucketCleanup(database, now);
	const windowStart = now - input.windowMs;
	const [bucket] = await database
		.insert(rateLimit)
		.values({ id: randomUUID(), key: input.key, count: 1, lastRequest: now })
		.onConflictDoUpdate({
			target: rateLimit.key,
			set: {
				count: sql<number>`case when ${rateLimit.lastRequest} <= ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
				lastRequest: sql<number>`case when ${rateLimit.lastRequest} <= ${windowStart} then ${now} else ${rateLimit.lastRequest} end`,
			},
		})
		.returning({
			count: rateLimit.count,
			lastRequest: rateLimit.lastRequest,
		});

	if (!bucket) {
		return { allowed: false, retryAfterSeconds: 1 };
	}

	return {
		allowed: bucket.count <= input.max,
		retryAfterSeconds: Math.max(
			1,
			Math.ceil((bucket.lastRequest + input.windowMs - now) / 1_000),
		),
	};
}

export function createRateLimitGuard(options: {
	database: Database;
	persistent: boolean;
}) {
	return async (input: RateLimitInput): Promise<RateLimitResult> => {
		if (!options.persistent) return consumeMemory(input);
		return consumeDatabase(options.database, input);
	};
}

const verificationCooldownMs = 5 * 60 * 1_000;
const verificationDailyMs = 24 * 60 * 60 * 1_000;
const verificationDailyMax = 5;
const verificationGlobalDailyMax = 80;

function verificationEmailKey(email: string) {
	return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Limits verification mail independently of request IP. Email addresses are
 * hashed before they become bucket keys so the rate-limit table does not
 * become a directory of customer addresses.
 */
export function createVerificationEmailGuard(options: {
	database: Database;
	persistent: boolean;
	globalDailyMax?: number;
	globalKey?: string;
}) {
	const guard = createRateLimitGuard(options);
	const globalKey = options.globalKey ?? "email-verification:global";

	return async (email: string): Promise<RateLimitResult> => {
		const normalizedEmail = email.trim().toLowerCase();
		if (!normalizedEmail) {
			return { allowed: false, retryAfterSeconds: 60 };
		}

		const emailKey = `email-verification:${verificationEmailKey(normalizedEmail)}`;
		const cooldown = await guard({
			key: `${emailKey}:cooldown`,
			windowMs: verificationCooldownMs,
			max: 1,
		});
		if (!cooldown.allowed) return cooldown;

		const daily = await guard({
			key: `${emailKey}:daily`,
			windowMs: verificationDailyMs,
			max: verificationDailyMax,
		});
		if (!daily.allowed) return daily;

		return guard({
			key: `${globalKey}:daily`,
			windowMs: verificationDailyMs,
			max: options.globalDailyMax ?? verificationGlobalDailyMax,
		});
	};
}

export function getClientIp(input: {
	request: Request;
	server: { requestIP(request: Request): { address: string } | null } | null;
	trustedProxyIps?: readonly string[];
}) {
	const peerAddress = input.server?.requestIP(input.request)?.address;
	if (isTrustedProxy(peerAddress, input.trustedProxyIps ?? [])) {
		const forwarded = input.request.headers.get("x-forwarded-for");
		if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
		const realIp = input.request.headers.get("x-real-ip");
		if (realIp) return realIp.trim();
	}
	return peerAddress ?? "unknown";
}

export function parseTrustedProxyIps(value?: string): readonly string[] {
	return (value ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}
