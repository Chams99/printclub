type VerificationEmailInput = {
	to: string;
	name: string;
	url: string;
};

const resendApiUrl = "https://api.resend.com/emails";

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

export async function sendVerificationEmail({
	to,
	name,
	url,
}: VerificationEmailInput) {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.EMAIL_FROM;

	if (!apiKey || !from) {
		if (
			process.env.NODE_ENV === "development" ||
			process.env.NODE_ENV === "test"
		) {
			console.info(`[printclub] Verification URL for ${to}: ${url}`);
			return;
		}
		throw new Error("Email delivery is not configured");
	}

	const response = await fetch(resendApiUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from,
			to: [to],
			subject: "Verify your printclub email",
			text: `Hi ${name},\n\nVerify your printclub email by opening this link:\n${url}\n\nThis link expires in one hour. If you did not create a printclub account, you can ignore this message.`,
			html: `<p>Hi ${escapeHtml(name)},</p><p>Verify your printclub email to keep your account secure:</p><p><a href="${escapeHtml(url)}">Verify my email</a></p><p>This link expires in one hour. If you did not create a printclub account, you can ignore this message.</p>`,
		}),
		signal: AbortSignal.timeout(10_000),
	});

	if (!response.ok) {
		console.error(
			`[printclub] Verification email provider rejected the request (${response.status})`,
		);
		throw new Error("Email delivery failed");
	}
}
