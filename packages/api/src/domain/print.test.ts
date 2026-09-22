import { describe, expect, it } from "bun:test";

import { catalog, designDocumentSchema, orderRequestSchema } from "./print";

describe("print domain contracts", () => {
	it("keeps every catalog product valid", () => {
		for (const product of catalog) {
			expect(product.id.length).toBeGreaterThan(0);
			expect(product.widthMm).toBeGreaterThan(0);
			expect(product.heightMm).toBeGreaterThan(0);
		}
	});

	it("rejects unsafe order requests", () => {
		expect(
			orderRequestSchema.safeParse({
				designId: "x",
				productId: "classic-10x15",
				quantity: 0,
				contactName: "A",
				contactEmail: "not-email",
			}).success,
		).toBe(false);
	});

	it("rejects non-finite and unbounded document geometry", () => {
		const result = designDocumentSchema.safeParse({
			schemaVersion: 1,
			id: "guest-design",
			productId: "classic-10x15",
			width: Number.POSITIVE_INFINITY,
			height: 900,
			background: "#fff",
			elements: [],
			updatedAt: new Date().toISOString(),
		});
		expect(result.success).toBe(false);
	});

	it("accepts the smallest valid saved design", () => {
		const result = designDocumentSchema.safeParse({
			schemaVersion: 1,
			id: "guest-design",
			productId: "classic-10x15",
			width: 600,
			height: 900,
			background: "#fff",
			elements: [],
			updatedAt: new Date().toISOString(),
		});
		expect(result.success).toBe(true);
	});
});
