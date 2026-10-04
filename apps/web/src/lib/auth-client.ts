import { createAuthClient } from "better-auth/react";

import { ENV } from "../runtime-env";

export const authClient = createAuthClient({
	baseURL: ENV.VITE_SERVER_URL,
	// Prevent auth requests from leaving forms in a permanent loading state
	// when a proxy, blocked request, or network connection never responds.
	fetchOptions: { timeout: 20_000 },
});

export const googleSignInEnabled = Boolean(ENV.VITE_GOOGLE_CLIENT_ID);
