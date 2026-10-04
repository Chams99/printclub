import { describe, expect, test } from "bun:test";
import { parseDemoOrders } from "./demo-orders";

const order = {
	id: "demo-one",
	productId: "classic-10x15",
	quantity: 1,
	contactName: "Demo",
	contactEmail: "demo@example.com",
	createdAt: "2026-10-04T12:00:00.000Z",
};
describe("browser requests", () => {
	test("malformed stored rows cannot crash date/product rendering", () => {
		expect(
			parseDemoOrders(
				JSON.stringify([
					order,
					{ ...order, createdAt: "broken" },
					{ ...order, quantity: 200 },
					null,
				]),
			),
		).toHaveLength(1);
		expect(() => parseDemoOrders("{}")).toThrow();
	});
	test("legacy offline rows must not look received", () => {
		expect(
			parseDemoOrders(JSON.stringify([{ ...order, id: "offline-123" }]))[0]
				?.status,
		).toBe("local");
	});
});
