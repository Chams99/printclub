/** Normalize validation errors from TanStack Form, Zod, and auth responses. */
export function getFormErrorMessage(error: unknown): string {
	if (typeof error === "string") return error;
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === "string") return message;
	}
	return "";
}

export function getAuthErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("error" in error)) {
		return undefined;
	}
	const responseError = (error as { error?: { code?: unknown } }).error;
	return typeof responseError?.code === "string"
		? responseError.code
		: undefined;
}

export function isVerificationEmailFailure(error: unknown) {
	if (getAuthErrorCode(error) === "EMAIL_NOT_VERIFIED") return true;
	const responseError =
		typeof error === "object" && error !== null && "error" in error
			? (error as { error?: { message?: unknown } }).error
			: undefined;
	const message =
		typeof responseError?.message === "string"
			? responseError.message
			: error instanceof Error
				? error.message
				: "";
	const normalized = message.toLowerCase();
	return (
		normalized.includes("verification email temporarily unavailable") ||
		normalized.includes("email delivery failed") ||
		normalized.includes("email delivery is not configured")
	);
}

function retryAfterHeader(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const value = error as {
		response?: { headers?: unknown };
		meta?: { response?: { headers?: unknown } };
		error?: { response?: { headers?: unknown } };
	};
	const headers =
		value.response?.headers ??
		value.meta?.response?.headers ??
		value.error?.response?.headers;
	if (typeof headers !== "object" || headers === null) return undefined;
	const get = (headers as { get?: unknown }).get;
	if (typeof get === "function") {
		try {
			const result = get.call(headers, "retry-after");
			return typeof result === "string" ? result : undefined;
		} catch {
			return undefined;
		}
	}
	for (const [name, headerValue] of Object.entries(headers)) {
		if (name.toLowerCase() === "retry-after" && typeof headerValue === "string")
			return headerValue;
	}
	return undefined;
}

function retryAfterSeconds(error: unknown): number | undefined {
	const header = retryAfterHeader(error)?.trim();
	if (!header) return undefined;
	const maximumSeconds = 24 * 60 * 60;
	if (/^\d+$/.test(header)) {
		const seconds = Number(header);
		return seconds > 0 && seconds <= maximumSeconds ? seconds : undefined;
	}
	const date = Date.parse(header);
	if (!Number.isFinite(date)) return undefined;
	const seconds = Math.ceil((date - Date.now()) / 1000);
	return seconds > 0 && seconds <= maximumSeconds ? seconds : undefined;
}

function rateLimitMessage(error: unknown): string {
	const seconds = retryAfterSeconds(error);
	if (seconds === undefined)
		return "Too many attempts. Wait before trying again, then retry.";
	const wait =
		seconds < 60
			? `${seconds} second${seconds === 1 ? "" : "s"}`
			: seconds < 60 * 60
				? `${Math.ceil(seconds / 60)} minutes`
				: `${Math.ceil(seconds / (60 * 60))} hours`;
	return `Too many attempts. Wait ${wait}, then try again.`;
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
	if (
		error instanceof Error &&
		(error.name === "AbortError" || /timed? ?out|timeout/i.test(error.message))
	) {
		return "This request took too long. Check your connection and try again.";
	}
	if (typeof error === "object" && error !== null && "error" in error) {
		const responseError = (
			error as {
				error?: {
					code?: unknown;
					message?: unknown;
					status?: unknown;
					statusText?: unknown;
				};
			}
		).error;
		const codeMessages: Record<string, string> = {
			INVALID_EMAIL_OR_PASSWORD: "The email or password is incorrect.",
			INVALID_PASSWORD: "The email or password is incorrect.",
			INVALID_EMAIL: "Enter a valid email address.",
			PASSWORD_TOO_SHORT: "Use a password with at least 8 characters.",
			PASSWORD_TOO_LONG: "Choose a shorter password.",
			EMAIL_PASSWORD_SIGN_UP_DISABLED:
				"Email sign-up is temporarily unavailable. Try Google sign-in or try again later.",
			EMAIL_PASSWORD_DISABLED:
				"Email sign-in is temporarily unavailable. Try Google sign-in or try again later.",
			USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
				"This email already has a printclub account. Choose Sign In, then continue with Google if you used Google.",
			USER_ALREADY_EXISTS:
				"This email already has a printclub account. Choose Sign In to continue.",
			account_not_linked:
				"This email already has a password account. Sign in with your password first, then connect Google from Account settings.",
			unable_to_link_account:
				"Google could not be connected to this account. Try again, or contact support if it keeps happening.",
			EMAIL_NOT_VERIFIED:
				"Verify your email address first, then try signing in again.",
			SECURITY_CHECK_REQUIRED:
				"Complete the security check, then submit the form again.",
		};
		if (
			responseError?.code === "TOO_MANY_REQUESTS" ||
			responseError?.status === 429
		) {
			return rateLimitMessage(error);
		}
		if (
			typeof responseError?.code === "string" &&
			Object.hasOwn(codeMessages, responseError.code)
		) {
			return codeMessages[responseError.code];
		}
		if (responseError?.status === 403) {
			return "This request was blocked. Refresh the page and try again.";
		}
		if (typeof responseError?.message === "string") {
			const normalized = responseError.message.toLowerCase();
			if (normalized.includes("account not linked")) {
				return codeMessages.account_not_linked;
			}
			if (isVerificationEmailFailure(error)) {
				return "We couldn't send a verification email. Your account may already be created. Wait up to five minutes, then sign in to request a fresh link.";
			}
			if (
				typeof responseError?.status === "number" &&
				responseError.status >= 500
			) {
				return "Printclub is having trouble right now. Wait a moment and try again.";
			}
		}
		if (
			typeof responseError?.status === "number" &&
			responseError.status >= 500
		) {
			return "Printclub is having trouble right now. Wait a moment and try again.";
		}
	}
	if (isVerificationEmailFailure(error)) {
		return "We couldn't send a verification email. Your account may already be created. Wait up to five minutes, then sign in to request a fresh link.";
	}
	if (
		error instanceof Error &&
		error.message.toLowerCase().includes("account not linked")
	) {
		return "This email already has a password account. Sign in with your password first, then connect Google from Account settings.";
	}
	return fallback;
}
