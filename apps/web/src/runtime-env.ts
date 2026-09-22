type WebEnv = {
	NODE_ENV: "development" | "production" | "test";
	VITE_SERVER_URL: string;
	VITE_GOOGLE_CLIENT_ID?: string;
};

const serverUrl = import.meta.env.VITE_SERVER_URL;

if (!serverUrl) {
	throw new Error("Missing required environment variable: VITE_SERVER_URL");
}

export const ENV: WebEnv = {
	NODE_ENV: import.meta.env.MODE as WebEnv["NODE_ENV"],
	VITE_SERVER_URL: serverUrl,
	VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
};
