import { createAuthClient } from "better-auth/react";

import { ENV } from "../runtime-env";

export const authClient = createAuthClient({
	baseURL: ENV.VITE_SERVER_URL,
});

export const googleSignInEnabled = Boolean(ENV.VITE_GOOGLE_CLIENT_ID);
