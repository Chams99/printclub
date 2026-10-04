import { getProduct } from "@PhotoPrinting/api/domain/print";

const ordersKey = "printclub:demo-orders";
export type DemoOrder = {
	id: string;
	designId?: string;
	draftId?: string;
	productId: string;
	quantity: number;
	contactName: string;
	contactEmail: string;
	createdAt: string;
	status: "received" | "local";
};

export function parseDemoOrders(raw: string | null): DemoOrder[] {
	const values: unknown = JSON.parse(raw ?? "[]");
	if (!Array.isArray(values))
		throw new Error("Stored requests are not a list.");
	return values.flatMap((value): DemoOrder[] => {
		if (!value || typeof value !== "object") return [];
		const order = value as DemoOrder;
		if (
			typeof order.id !== "string" ||
			typeof order.productId !== "string" ||
			!getProduct(order.productId) ||
			!Number.isInteger(order.quantity) ||
			order.quantity < 1 ||
			order.quantity > 100 ||
			typeof order.contactName !== "string" ||
			typeof order.contactEmail !== "string" ||
			typeof order.createdAt !== "string" ||
			!Number.isFinite(Date.parse(order.createdAt))
		)
			return [];
		return [
			{
				...order,
				status: order.id.startsWith("offline-") ? "local" : "received",
			},
		];
	});
}

export function readDemoOrders(): DemoOrder[] {
	return parseDemoOrders(localStorage.getItem(ordersKey));
}

export function rememberDemoOrder(order: DemoOrder): void {
	const orders = readDemoOrders();
	localStorage.setItem(
		ordersKey,
		JSON.stringify(
			[...orders.filter((entry) => entry.id !== order.id), order].slice(-100),
		),
	);
}
