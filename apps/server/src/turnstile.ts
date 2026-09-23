import { ENV } from "./env.server";

const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const protectedAuthPaths = new Set([
	"/sign-up/email",
	"/sign-in/email",
	"/send-verification-email",
]);

type TurnstileResult = {
	success: boolean;
	hostname?: string;
	action?: string;
	"error-codes"?: string[];
};

function authPath(request: Request) {
	const pathname = new URL(request.url).pathname;
	return pathname.replace(/^\/api\/auth/, "") || "/";
}

export function isTurnstileProtectedPath(pathname: string) {
	return protectedAuthPaths.has(pathname);
}

function expectedAction(pathname: string) {
	if (pathname === "/sign-up/email") return "sign-up";
	if (pathname === "/sign-in/email") return "sign-in";
	return "send-verification-email";
}

function expectedHostnames() {
	return (ENV.TURNSTILE_EXPECTED_HOSTNAMES ?? "")
		.split(",")
		.map((hostname) => hostname.trim().toLowerCase())
		.filter(Boolean);
}

export async function verifyTurnstileForRequest(request: Request) {
	const pathname = authPath(request);
	if (!ENV.TURNSTILE_SECRET_KEY || !isTurnstileProtectedPath(pathname)) {
		return { allowed: true as const };
	}

	const token = request.headers.get("x-printclub-turnstile")?.trim();
	if (!token || token.length > 2_048) {
		return { allowed: false as const, reason: "missing-token" };
	}

	try {
		const body = new URLSearchParams({
			secret: ENV.TURNSTILE_SECRET_KEY,
			response: token,
		});
		const response = await fetch(verifyUrl, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body,
			signal: AbortSignal.timeout(5_000),
		});
		if (!response.ok) {
			return { allowed: false as const, reason: "provider-error" };
		}
		const result = (await response.json()) as TurnstileResult;
		const allowedHosts = expectedHostnames();
		const hostname = result.hostname?.toLowerCase();
		const hostnameAllowed =
			allowedHosts.length === 0 ||
			(hostname !== undefined && allowedHosts.includes(hostname));
		if (
			!result.success ||
			!hostnameAllowed ||
			result.action !== expectedAction(pathname)
		) {
			console.warn("[printclub] Turnstile rejected an auth request", {
				reason: result["error-codes"]?.slice(0, 3) ?? ["invalid-token"],
			});
			return { allowed: false as const, reason: "invalid-token" };
		}
		return { allowed: true as const };
	} catch {
		return { allowed: false as const, reason: "provider-error" };
	}
}
