import { describe, expect, it } from "bun:test";

import { getAuthErrorMessage, getFormErrorMessage } from "./form-error";

describe("form error messages", () => {
	it("normalizes string and object validation errors", () => {
		expect(getFormErrorMessage("Email is required")).toBe("Email is required");
		expect(getFormErrorMessage({ message: "Password is too short" })).toBe(
			"Password is too short",
		);
	});

	it("replaces opaque network errors with an actionable fallback", () => {
		expect(
			getAuthErrorMessage(
				new TypeError("Failed to fetch"),
				"Try again shortly.",
			),
		).toBe("Try again shortly.");
	});

	it("explains timed out auth requests instead of surfacing abort jargon", () => {
		const timeout = new DOMException("The operation was aborted", "AbortError");
		expect(getAuthErrorMessage(timeout, "Generic fallback")).toBe(
			"This request took too long. Check your connection and try again.",
		);
	});

	it("distinguishes a blocked security challenge from unverified email", () => {
		expect(
			getAuthErrorMessage(
				{ error: { code: "SECURITY_CHECK_REQUIRED", status: 403 } },
				"Fallback",
			),
		).toBe("Complete the security check, then submit the form again.");
	});

	it("uses bounded server retry guidance for rate limits and hides server internals", () => {
		expect(
			getAuthErrorMessage(
				{ error: { status: 429, message: "rate limit" } },
				"Fallback",
			),
		).toBe("Too many attempts. Wait before trying again, then retry.");
		expect(
			getAuthErrorMessage(
				{
					error: { code: "TOO_MANY_REQUESTS", status: 429 },
					meta: {
						response: {
							headers: new Headers({ "Retry-After": "300" }),
						},
					},
				},
				"Fallback",
			),
		).toBe("Too many attempts. Wait 5 minutes, then try again.");
		expect(
			getAuthErrorMessage(
				{
					error: { status: 429 },
					response: {
						headers: new Headers({
							"Retry-After": new Date(Date.now() + 5 * 60_000).toUTCString(),
						}),
					},
				},
				"Fallback",
			),
		).toBe("Too many attempts. Wait 5 minutes, then try again.");
		expect(
			getAuthErrorMessage(
				{
					error: { status: 429 },
					response: {
						headers: new Headers({ "Retry-After": "172800" }),
					},
				},
				"Fallback",
			),
		).toBe("Too many attempts. Wait before trying again, then retry.");
		expect(
			getAuthErrorMessage(
				{ error: { status: 500, message: "database connection refused" } },
				"Fallback",
			),
		).toBe(
			"Printclub is having trouble right now. Wait a moment and try again.",
		);
	});

	it("maps known authentication codes and hides unknown provider details", () => {
		expect(
			getAuthErrorMessage(
				{ error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } },
				"Fallback",
			),
		).toBe("The email or password is incorrect.");
		expect(
			getAuthErrorMessage(
				{ error: { status: 400, message: "provider secret detail" } },
				"Please try again.",
			),
		).toBe("Please try again.");
		expect(
			getAuthErrorMessage(
				new Error("postgres://private-host auth table failure"),
				"Please try again.",
			),
		).toBe("Please try again.");
		expect(
			getAuthErrorMessage(
				{ error: { code: "account_not_linked", message: "internal detail" } },
				"Fallback",
			),
		).toContain("Sign in with your password first");
		expect(
			getAuthErrorMessage(
				{ error: { status: 500, message: "email delivery failed" } },
				"Fallback",
			),
		).toContain("Wait up to five minutes");
	});
});
