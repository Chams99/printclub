import type { Session } from "@PhotoPrinting/auth";
import type { Database } from "@PhotoPrinting/db";

export type RateLimitGuard = (input: {
	key: string;
	windowMs: number;
	max: number;
}) => Promise<{
	allowed: boolean;
	retryAfterSeconds: number;
}>;

export type Context = {
	session: Session | null;
	db: Database;
	clientIp: string;
	rateLimit: RateLimitGuard;
};
