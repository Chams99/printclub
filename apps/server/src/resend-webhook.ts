import { suppressEmail } from "./email-suppression";
import { ENV } from "./env.server";
import { db } from "./services";

const maxWebhookAgeMs = 5 * 60 * 1_000;

type ResendEvent = {
	type?: string;
	data?: {
		to?: unknown;
		bounce?: { type?: string; subType?: string; message?: string };
	};
};

function decodeBase64(value: string) {
	const decoded = atob(value);
	return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function verifySignature(
	payload: string,
	headers: Headers,
	secret: string,
) {
	const id = headers.get("svix-id");
	const timestamp = headers.get("svix-timestamp");
	const signature = headers.get("svix-signature");
	if (!id || !timestamp || !signature) return false;
	const timestampMs = Number(timestamp) * 1_000;
	if (
		!Number.isFinite(timestampMs) ||
		Math.abs(Date.now() - timestampMs) > maxWebhookAgeMs
	) {
		return false;
	}
	if (!secret.startsWith("whsec_")) return false;
	const key = await crypto.subtle.importKey(
		"raw",
		decodeBase64(secret.slice("whsec_".length)),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signedPayload = new TextEncoder().encode(
		`${id}.${timestamp}.${payload}`,
	);
	for (const candidate of signature.split(" ")) {
		const [version, value] = candidate.split(",", 2);
		if (
			version === "v1" &&
			value &&
			(await crypto.subtle.verify(
				"HMAC",
				key,
				decodeBase64(value),
				signedPayload,
			))
		) {
			return true;
		}
	}
	return false;
}

function eventEmails(event: ResendEvent) {
	if (!["email.bounced", "email.complained"].includes(event.type ?? "")) {
		return [];
	}
	const bounceType = event.data?.bounce?.type;
	if (
		event.type === "email.bounced" &&
		bounceType &&
		!["Permanent", "Suppressed"].includes(bounceType)
	) {
		return [];
	}
	if (!Array.isArray(event.data?.to)) return [];
	return event.data.to.filter(
		(value): value is string =>
			typeof value === "string" && /^\S+@\S+\.\S+$/.test(value),
	);
}

export async function handleResendWebhook(request: Request) {
	if (!ENV.RESEND_WEBHOOK_SECRET) {
		return new Response("Not found", { status: 404 });
	}
	const payload = await request.text();
	if (
		!(await verifySignature(
			payload,
			request.headers,
			ENV.RESEND_WEBHOOK_SECRET,
		))
	) {
		return new Response("Invalid webhook", { status: 400 });
	}
	let event: ResendEvent;
	try {
		event = JSON.parse(payload) as ResendEvent;
	} catch {
		return new Response("Invalid webhook", { status: 400 });
	}
	const reason =
		event.data?.bounce?.subType ??
		event.data?.bounce?.type ??
		"permanent-bounce";
	for (const email of eventEmails(event)) {
		await suppressEmail(db, email, reason);
	}
	return Response.json({ received: true });
}
