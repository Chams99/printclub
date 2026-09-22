import { describe, expect, it } from "bun:test";

import {
	createRateLimitGuard,
	createVerificationEmailGuard,
	getClientIp,
	parseTrustedProxyIps,
} from "./rate-limit";

describe("rate-limit guard", () => {
	it("blocks a burst after the configured maximum", async () => {
		const guard = createRateLimitGuard({
			database: {} as never,
			persistent: false,
		});
		const key = `test:${crypto.randomUUID()}`;

		expect((await guard({ key, windowMs: 60_000, max: 2 })).allowed).toBe(true);
		expect((await guard({ key, windowMs: 60_000, max: 2 })).allowed).toBe(true);
		expect((await guard({ key, windowMs: 60_000, max: 2 })).allowed).toBe(
			false,
		);
	});

	it("uses the first forwarded address only when a proxy is trusted", () => {
		const request = new Request("https://printclub.test/trpc", {
			headers: {
				"x-forwarded-for": "203.0.113.10, 10.0.0.1",
			},
		});
		const server = {
			requestIP: () => ({ address: "10.0.0.1" }),
		};

		expect(
			getClientIp({
				request,
				server,
				trustedProxyIps: parseTrustedProxyIps("10.0.0.0/8"),
			}),
		).toBe("203.0.113.10");
		expect(getClientIp({ request, server, trustedProxyIps: [] })).toBe(
			"10.0.0.1",
		);
		expect(
			getClientIp({
				request,
				server,
				trustedProxyIps: parseTrustedProxyIps("192.0.2.0/24"),
			}),
		).toBe("10.0.0.1");
	});

	it("normalizes email addresses and blocks rapid verification sends", async () => {
		const guard = createVerificationEmailGuard({
			database: {} as never,
			persistent: false,
			globalKey: `test:verification:${crypto.randomUUID()}`,
		});

		expect((await guard(" Person@Example.com ")).allowed).toBe(true);
		expect((await guard("person@example.com")).allowed).toBe(false);
	});

	it("applies a shared daily cap across different addresses", async () => {
		const guard = createVerificationEmailGuard({
			database: {} as never,
			persistent: false,
			globalDailyMax: 2,
			globalKey: `test:verification:${crypto.randomUUID()}`,
		});

		expect((await guard("one@example.com")).allowed).toBe(true);
		expect((await guard("two@example.com")).allowed).toBe(true);
		expect((await guard("three@example.com")).allowed).toBe(false);
	});
});
