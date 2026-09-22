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

export function getAuthErrorMessage(error: unknown, fallback: string): string {
	const isUsefulMessage = (message: unknown): message is string =>
		typeof message === "string" &&
		message.length > 0 &&
		!/^(failed to fetch|network error)$/i.test(message.trim());
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
		};
		if (
			typeof responseError?.code === "string" &&
			codeMessages[responseError.code]
		) {
			return codeMessages[responseError.code];
		}
		if (responseError?.status === 403) {
			return "Verify your email address first, then try signing in again.";
		}
		if (isUsefulMessage(responseError?.message)) {
			const normalized = responseError.message.toLowerCase();
			if (normalized.includes("account not linked")) {
				return codeMessages.account_not_linked;
			}
			if (normalized.includes("email delivery failed")) {
				return "We couldn't send the verification email. Try again in a few minutes, then check your inbox and spam folder.";
			}
			if (normalized.includes("verification email temporarily unavailable")) {
				return "Verification email is temporarily unavailable. Wait a few minutes, then try again.";
			}
			return responseError.message;
		}
		if (isUsefulMessage(responseError?.statusText)) {
			return responseError.statusText;
		}
	}
	if (error instanceof Error && isUsefulMessage(error.message)) {
		return error.message;
	}
	return fallback;
}
