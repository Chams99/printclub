import { afterEach, describe, expect, it } from "bun:test";

import { sendVerificationEmail } from "./email";

const originalNodeEnv = process.env.NODE_ENV;
const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.EMAIL_FROM;
const originalFetch = globalThis.fetch;

afterEach(() => {
	process.env.NODE_ENV = originalNodeEnv;
	process.env.RESEND_API_KEY = originalApiKey;
	process.env.EMAIL_FROM = originalFrom;
	globalThis.fetch = originalFetch;
});

describe("verification email delivery", () => {
	it("logs a local verification URL without requiring a provider", async () => {
		process.env.NODE_ENV = "test";
		delete process.env.RESEND_API_KEY;
		delete process.env.EMAIL_FROM;

		await expect(
			sendVerificationEmail({
				to: "person@example.com",
				name: "Person",
				url: "http://localhost:3000/verify?token=test",
			}),
		).resolves.toBeUndefined();
	});

	it("sends through Resend with escaped HTML content", async () => {
		process.env.NODE_ENV = "production";
		process.env.RESEND_API_KEY = "re_test_key";
		process.env.EMAIL_FROM = "printclub <no-reply@example.com>";
		let request: Request | undefined;
		globalThis.fetch = (async (input, init) => {
			request = new Request(String(input), init as RequestInit);
			return new Response(null, { status: 200 });
		}) as typeof fetch;

		await sendVerificationEmail({
			to: "person@example.com",
			name: "<Person>",
			url: "https://example.com/verify?token=abc",
		});

		expect(request?.url).toBe("https://api.resend.com/emails");
		expect(request?.headers.get("authorization")).toBe("Bearer re_test_key");
		const body = (await request?.json()) as { html: string };
		expect(body.html).toContain("&lt;Person&gt;");
	});
});
