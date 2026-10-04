export type PublicServerError = {
	status: number;
	body: { code: string; message: string };
};

/** Map unexpected Elysia errors to stable public responses without their details. */
export function mapPublicServerError(input: {
	code: string | number;
	status?: number;
}): PublicServerError | null {
	if (input.code === "NOT_FOUND") return null;

	if (input.code === "VALIDATION") {
		return {
			status:
				input.status && input.status >= 400 && input.status < 500
					? input.status
					: 422,
			body: {
				code: "VALIDATION",
				message: "Check the submitted information and try again.",
			},
		};
	}

	if (input.code === "PARSE") {
		return {
			status:
				input.status && input.status >= 400 && input.status < 500
					? input.status
					: 400,
			body: {
				code: "PARSE_ERROR",
				message:
					"The request could not be read. Check its format and try again.",
			},
		};
	}

	if (
		input.code === "INVALID_COOKIE_SIGNATURE" ||
		input.code === "INVALID_FILE_TYPE" ||
		(typeof input.code === "number" && input.code >= 400 && input.code < 500)
	)
		return null;

	return {
		status:
			input.status && input.status >= 500 && input.status <= 599
				? input.status
				: 500,
		body: {
			code: "INTERNAL_SERVER_ERROR",
			message: "Printclub is having trouble right now. Please try again.",
		},
	};
}

type PublicErrorHookContext = {
	code: string | number;
	request: Request;
	set: { status?: unknown };
};

/** Elysia hook shared by the server and isolated thrown-route tests. */
export const publicServerErrorHandler = ({
	code,
	request,
	set,
}: PublicErrorHookContext) => {
	const publicError = mapPublicServerError({
		code,
		status: typeof set.status === "number" ? set.status : undefined,
	});
	if (!publicError) return;
	set.status = publicError.status;
	if (publicError.status >= 500) {
		console.error("[api] Unexpected request failure", {
			code,
			method: request.method,
			pathname: new URL(request.url).pathname,
			status: publicError.status,
		});
	}
	return publicError.body;
};
