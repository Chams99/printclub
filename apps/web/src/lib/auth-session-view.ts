export type AuthSessionView =
	| "loading"
	| "authenticated"
	| "anonymous"
	| "error";

/** Classify auth state without turning a pending or failed lookup into a guest. */
export function resolveAuthSessionView(
	hasSession: boolean,
	isPending: boolean,
	hasError: boolean,
): AuthSessionView {
	if (hasSession) return "authenticated";
	if (isPending) return "loading";
	if (hasError) return "error";
	return "anonymous";
}
