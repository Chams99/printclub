import { authClient } from "@/lib/auth-client";
import { resolveAuthSessionView } from "./auth-session-view";

export { resolveAuthSessionView } from "./auth-session-view";

/**
 * Keep "checking the session" distinct from a confirmed signed-out state.
 * A failed session request must never make authenticated actions look like
 * guest actions.
 */
export function useAuthSession() {
	const query = authClient.useSession();
	const session = query.data ?? null;
	const state = resolveAuthSessionView(
		Boolean(session),
		query.isPending,
		Boolean(query.error),
	);

	return {
		session,
		state,
		error: query.error,
		refetch: query.refetch,
	};
}

export type AuthSessionState = ReturnType<typeof useAuthSession>;
