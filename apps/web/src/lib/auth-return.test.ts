import { describe, expect, it } from "bun:test";

import { getSafeReturnPath } from "./auth-return";

describe("auth return paths", () => {
	it("accepts an internal path", () => {
		expect(getSafeReturnPath("/studio?draft=abc")).toBe("/studio?draft=abc");
	});

	it("rejects external and browser-normalized paths", () => {
		for (const value of [
			"https://evil.example",
			"//evil.example",
			"/\\evil.example",
			"/studio\\evil",
		]) {
			expect(getSafeReturnPath(value)).toBeUndefined();
		}
	});
});
