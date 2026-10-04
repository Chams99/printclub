const maxWebhookAgeMs = 5 * 60 * 1_000;

function decodeBase64(value: string) {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function verifyResendSignature(
	payload: string,
	headers: Headers,
	secret: string,
	now = Date.now(),
): Promise<boolean> {
	const id = headers.get("svix-id");
	const timestamp = headers.get("svix-timestamp");
	const signature = headers.get("svix-signature");
	if (
		!id ||
		!timestamp ||
		!signature ||
		!/^\d+$/.test(timestamp) ||
		!secret.startsWith("whsec_")
	)
		return false;
	const timestampMs = Number(timestamp) * 1_000;
	if (
		!Number.isFinite(timestampMs) ||
		Math.abs(now - timestampMs) > maxWebhookAgeMs
	)
		return false;
	try {
		const key = await crypto.subtle.importKey(
			"raw",
			decodeBase64(secret.slice(6)),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["verify"],
		);
		const signedPayload = new TextEncoder().encode(
			`${id}.${timestamp}.${payload}`,
		);
		for (const candidate of signature.split(" ")) {
			const [version, value] = candidate.split(",", 2);
			if (version !== "v1" || !value) continue;
			try {
				if (
					await crypto.subtle.verify(
						"HMAC",
						key,
						decodeBase64(value),
						signedPayload,
					)
				)
					return true;
			} catch {
				/* Ignore a malformed signature candidate; another may be valid during rotation. */
			}
		}
	} catch {
		return false;
	}
	return false;
}
