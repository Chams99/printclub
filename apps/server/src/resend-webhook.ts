import { suppressEmail } from "./email-suppression";
import { ENV } from "./env.server";
import { verifyResendSignature } from "./resend-signature";
import { db } from "./services";

type ResendEvent = {
	type?: string;
	data?: {
		to?: unknown;
		bounce?: { type?: string; subType?: string; message?: string };
	};
};

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
		!(await verifyResendSignature(
			payload,
			request.headers,
			ENV.RESEND_WEBHOOK_SECRET,
		))
	) {
		return new Response("Invalid webhook", { status: 400 });
	}
	let event: ResendEvent;
	try {
		const parsed: unknown = JSON.parse(payload);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return new Response("Invalid webhook", { status: 400 });
		event = parsed as ResendEvent;
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
