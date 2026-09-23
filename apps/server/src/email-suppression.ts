import type { Database } from "@PhotoPrinting/db";
import { emailSuppression } from "@PhotoPrinting/db/schema/auth";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

export function hashEmail(email: string) {
	return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export async function isEmailSuppressed(database: Database, email: string) {
	const [row] = await database
		.select({ emailHash: emailSuppression.emailHash })
		.from(emailSuppression)
		.where(eq(emailSuppression.emailHash, hashEmail(email)))
		.limit(1);
	return Boolean(row);
}

export async function suppressEmail(
	database: Database,
	email: string,
	reason: string,
) {
	const emailHash = hashEmail(email);
	await database
		.insert(emailSuppression)
		.values({ emailHash, reason: reason.slice(0, 120) })
		.onConflictDoUpdate({
			target: emailSuppression.emailHash,
			set: { reason: reason.slice(0, 120), updatedAt: new Date() },
		});
}
