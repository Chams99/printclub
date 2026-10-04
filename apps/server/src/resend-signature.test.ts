import { describe, expect, test } from "bun:test";
import { verifyResendSignature } from "./resend-signature";

const keyBytes = new TextEncoder().encode("test-only-webhook-secret-32-bytes!");
const secret = `whsec_${btoa(String.fromCharCode(...keyBytes))}`;
const timestamp = "1791115200";
const now = Number(timestamp) * 1000;
const payload =
	'{"type":"email.bounced","data":{"to":["example@example.test"]}}';
async function signedHeaders() {
	const key = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign(
			"HMAC",
			key,
			new TextEncoder().encode(`evt-test.${timestamp}.${payload}`),
		),
	);
	return new Headers({
		"svix-id": "evt-test",
		"svix-timestamp": timestamp,
		"svix-signature": `v1,${btoa(String.fromCharCode(...signature))}`,
	});
}
describe("Resend signature validation", () => {
	test("accepts a genuine signed payload", async () => {
		expect(
			await verifyResendSignature(payload, await signedHeaders(), secret, now),
		).toBe(true);
	});
	test("rejects tampering and stale requests", async () => {
		const headers = await signedHeaders();
		expect(
			await verifyResendSignature(`${payload} `, headers, secret, now),
		).toBe(false);
		expect(
			await verifyResendSignature(payload, headers, secret, now + 301_000),
		).toBe(false);
	});
	test("malformed signatures do not crash the endpoint", async () => {
		const headers = await signedHeaders();
		headers.set("svix-signature", `v1,%%% ${headers.get("svix-signature")}`);
		expect(await verifyResendSignature(payload, headers, secret, now)).toBe(
			true,
		);
		expect(
			await verifyResendSignature(payload, headers, "whsec_%%%", now),
		).toBe(false);
		expect(
			await verifyResendSignature(payload, new Headers(), secret, now),
		).toBe(false);
	});
});
