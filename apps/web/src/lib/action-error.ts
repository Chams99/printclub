export type ActionErrorContext = "save" | "photo" | "request" | "load" | "copy";

/** Public, actionable messages; never expose provider or database internals. */
export function actionErrorMessage(
	error: unknown,
	context: ActionErrorContext,
): string {
	const value =
		error && typeof error === "object"
			? (error as {
					name?: string;
					message?: string;
					data?: { code?: string; httpStatus?: number };
					status?: number;
					meta?: { response?: { status?: number; headers?: Headers } };
				})
			: null;
	const code = value?.data?.code;
	const status =
		value?.data?.httpStatus ?? value?.status ?? value?.meta?.response?.status;
	if (code === "UNAUTHORIZED" || status === 401)
		return "Your session has expired. Sign in again to send this request. Your design is still here.";
	if (code === "TOO_MANY_REQUESTS" || status === 429) {
		const retryAfter = Number(
			value?.meta?.response?.headers?.get("retry-after"),
		);
		const wait =
			Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 3600
				? `Wait about ${retryAfter < 60 ? `${Math.ceil(retryAfter)} seconds` : `${Math.ceil(retryAfter / 60)} minutes`}`
				: "Wait up to an hour";
		return `You’ve reached the request limit. ${wait} before trying again. Your design and details are still here.`;
	}
	if (code === "FORBIDDEN" || status === 403)
		return "This account cannot send the request. Verify your email or sign in again, then retry.";
	if (code === "BAD_REQUEST")
		return "The request details could not be accepted. Check the name, email, and quantity, then try again.";
	if (
		context === "request" &&
		(code === "INTERNAL_SERVER_ERROR" ||
			(status !== undefined && status >= 500))
	)
		return "Printclub could not process this request. Try again in a moment. Your design and details are still here.";
	if (context === "save")
		return "Your changes could not be saved in this browser. Keep this tab open, download a preview, and check that site storage is allowed and has space before retrying.";
	if (context === "load")
		return "Your saved design could not be opened. Allow site storage in this browser and retry. Your existing saved data has been kept.";
	if (context === "copy")
		return "Your browser blocked clipboard access. Select and copy the project address shown below. It opens only in this browser.";
	if (
		context === "photo" &&
		error instanceof Error &&
		/^(Choose a JPEG|Images must|This image|The photo|Photos must)/.test(
			error.message,
		)
	)
		return error.message;
	if (context === "photo")
		return "This photo could not be imported. Choose a JPEG, PNG, or WebP file up to 8 MB and try again.";
	return "The request could not be sent. Check your connection and try again. Your design and request details are still here.";
}
