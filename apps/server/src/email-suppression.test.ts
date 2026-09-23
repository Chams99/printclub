import { describe, expect, it } from "bun:test";

import { hashEmail, normalizeEmail } from "./email-suppression";

describe("email suppression identifiers", () => {
	it("normalizes addresses before hashing", () => {
		expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
		expect(hashEmail("Person@Example.COM")).toBe(
			hashEmail("person@example.com"),
		);
	});

	it("does not expose the source address in the suppression key", () => {
		const hash = hashEmail("person@example.com");
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
		expect(hash).not.toContain("person@example.com");
	});
});
