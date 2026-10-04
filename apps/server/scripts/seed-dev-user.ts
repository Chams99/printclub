/**
 * Creates (or resets) a verified email/password account for local development,
 * so the signed-in pages can be reviewed without a verification email.
 *
 *   bun run seed:dev-user
 *
 * Override the defaults with SEED_USER_EMAIL, SEED_USER_PASSWORD, and
 * SEED_USER_NAME. Refuses to run in production or against a non-local database.
 */
import { createDb } from "@PhotoPrinting/db";
import { account, user } from "@PhotoPrinting/db/schema/auth";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

const devUser = {
	email: (process.env.SEED_USER_EMAIL ?? "demo@printclub.test").toLowerCase(),
	password: process.env.SEED_USER_PASSWORD ?? "printclub-demo-2026",
	name: process.env.SEED_USER_NAME ?? "Avery Demo",
};

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function localDatabaseUrl() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
	if (process.env.NODE_ENV === "production") {
		throw new Error("Refusing to seed a dev user when NODE_ENV=production.");
	}
	const { hostname } = new URL(databaseUrl);
	if (!localHosts.has(hostname)) {
		throw new Error(`Refusing to seed a non-local database (${hostname}).`);
	}
	return databaseUrl;
}

// Matches the minPasswordLength configured in @PhotoPrinting/auth.
if (devUser.password.length < 8) {
	throw new Error("SEED_USER_PASSWORD must be at least 8 characters.");
}

const db = createDb({ DATABASE_URL: localDatabaseUrl() });
const passwordHash = await hashPassword(devUser.password);
const now = new Date();

const [existing] = await db
	.select({ id: user.id })
	.from(user)
	.where(eq(user.email, devUser.email))
	.limit(1);
const userId = existing?.id ?? crypto.randomUUID();

await db.transaction(async (tx) => {
	if (existing) {
		await tx
			.update(user)
			.set({ name: devUser.name, emailVerified: true, updatedAt: now })
			.where(eq(user.id, userId));
	} else {
		await tx.insert(user).values({
			id: userId,
			name: devUser.name,
			email: devUser.email,
			emailVerified: true,
			createdAt: now,
			updatedAt: now,
		});
	}

	const [credential] = await tx
		.select({ id: account.id })
		.from(account)
		.where(
			and(eq(account.userId, userId), eq(account.providerId, "credential")),
		)
		.limit(1);
	if (credential) {
		await tx
			.update(account)
			.set({ password: passwordHash, updatedAt: now })
			.where(eq(account.id, credential.id));
	} else {
		await tx.insert(account).values({
			id: crypto.randomUUID(),
			accountId: userId,
			providerId: "credential",
			userId,
			password: passwordHash,
			createdAt: now,
			updatedAt: now,
		});
	}
});

console.info(
	`[printclub] Dev user ${existing ? "reset" : "created"}: ${devUser.email} (verified). ` +
		"The password is the default in scripts/seed-dev-user.ts unless SEED_USER_PASSWORD was set.",
);
await db.$client.end();
