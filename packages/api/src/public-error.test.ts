import { describe, expect, it } from "bun:test";

import { formatPublicTrpcError } from "./public-error";

describe("formatPublicTrpcError", () => {
	const shape = {
		message: "Database password leaked in error message",
		code: -32603,
		data: {
			code: "INTERNAL_SERVER_ERROR",
			httpStatus: 500,
			stack: "private stack trace",
			path: "orders.list",
		},
	};

	it("replaces internal messages and removes stack traces", () => {
		const formatted = formatPublicTrpcError(shape, "INTERNAL_SERVER_ERROR");
		expect(formatted.message).toBe(
			"Printclub is having trouble right now. Please try again.",
		);
		expect(formatted.data.stack).toBeUndefined();
		expect(formatted.data.path).toBe("orders.list");
	});

	it("preserves known auth and rate-limit messages while removing stacks", () => {
		const formatted = formatPublicTrpcError(
			{
				...shape,
				message: "Authentication required",
				data: { ...shape.data, code: "UNAUTHORIZED", httpStatus: 401 },
			},
			"UNAUTHORIZED",
		);
		expect(formatted.message).toBe("Authentication required");
		expect(formatted.data.stack).toBeUndefined();
	});
});
