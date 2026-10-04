import { Button } from "@PhotoPrinting/ui/components/button";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { getSafeReturnPath } from "@/lib/auth-return";

export const Route = createFileRoute("/_auth")({
	ssr: false,
	component: AuthLayout,
	beforeLoad: async ({ location }) => {
		let session: Awaited<ReturnType<typeof authClient.getSession>>;
		try {
			// Better Fetch's `throw: true` changes successful responses from
			// `{ data, error }` to the raw session value. Keep the normal response
			// shape here because the redirect below needs to inspect `session.data`.
			session = await authClient.getSession();
			if (session.error) throw session.error;
		} catch {
			throw new Error(
				"We couldn’t verify your sign-in. Check your connection and retry.",
			);
		}
		if (!session.data) {
			throw redirect({
				to: "/login",
				search: {
					mode: "signin",
					returnTo: getSafeReturnPath(location.href) ?? "/dashboard",
				},
			});
		}
		return { session };
	},
	errorComponent: ({ reset }) => (
		<main className="not-found-page" id="main-content">
			<div className="not-found-page__inner">
				<p className="eyebrow eyebrow--blue">Account connection</p>
				<CircleAlert aria-hidden="true" />
				<h1>We couldn’t verify your sign-in.</h1>
				<p>
					Your account and saved work are safe. Check your connection, then
					retry.
				</p>
				<div className="not-found-page__actions">
					<Button type="button" onClick={reset}>
						Try again
					</Button>
					<Link className="button-v2 button-v2--ghost" to="/">
						Return home
					</Link>
				</div>
			</div>
		</main>
	),
});

function AuthLayout() {
	return <Outlet />;
}
