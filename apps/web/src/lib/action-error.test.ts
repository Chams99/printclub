import { describe, expect, test } from "bun:test";
import { actionErrorMessage } from "./action-error";

describe("action errors", () => {
	test("API internals are not presented to the visitor", () => {
		expect(
			actionErrorMessage(
				new Error("postgres://secret-password server stack"),
				"request",
			),
		).not.toContain("secret-password");
	});
	test("server failures are distinct from connection failures and stay redacted", () => {
		const message = actionErrorMessage(
			{
				message: "postgres://secret-password provider stack",
				data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
			},
			"request",
		);
		expect(message).toBe(
			"Printclub could not process this request. Try again in a moment. Your design and details are still here.",
		);
		expect(message).not.toContain("secret-password");
		expect(message).not.toContain("connection");
		expect(
			actionErrorMessage({ status: 503, message: "private upstream detail" }, "request"),
		).toContain("could not process this request");
	});
	test("expired sessions, quotas, and storage failures explain recovery", () => {
		expect(
			actionErrorMessage({ data: { code: "UNAUTHORIZED" } }, "request"),
		).toContain("Sign in again");
		expect(
			actionErrorMessage({ data: { code: "TOO_MANY_REQUESTS" } }, "request"),
		).toContain("limit");
		expect(
			actionErrorMessage(
				new DOMException("Quota", "QuotaExceededError"),
				"save",
			),
		).toContain("Keep this tab open");
	});
	test("edge limits show their server supplied retry interval", () => {
		expect(
			actionErrorMessage(
				{
					meta: {
						response: {
							status: 429,
							headers: new Headers({ "retry-after": "10" }),
						},
					},
				},
				"request",
			),
		).toContain("10 seconds");
	});
});
