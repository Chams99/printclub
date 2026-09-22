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
			getAuthErrorMessage(new TypeError("Failed to fetch"), "Try again shortly."),
		).toBe("Try again shortly.");
	});
});
