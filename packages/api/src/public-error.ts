type ErrorShape = {
	message: string;
	data: {
		stack?: string;
	};
};

/** Hide internal 500 details and stack traces while preserving known client errors. */
export function formatPublicTrpcError<T extends ErrorShape>(
	shape: T,
	code: string,
): T {
	return {
		...shape,
		...(code === "INTERNAL_SERVER_ERROR"
			? {
					message: "Printclub is having trouble right now. Please try again.",
				}
			: {}),
		data: {
			...shape.data,
			stack: undefined,
		},
	} as T;
}
