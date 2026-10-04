import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { googleSignInEnabled } from "@/lib/auth-client";
import { getSafeReturnPath } from "@/lib/auth-return";

type LoginSearch = {
	returnTo?: string;
	mode?: "signin" | "signup";
};

function parseLoginSearch(search: Record<string, unknown>): LoginSearch {
	const returnTo = getSafeReturnPath(
		typeof search.returnTo === "string" ? search.returnTo : undefined,
	);
	return {
		...(returnTo ? { returnTo } : {}),
		mode: search.mode === "signup" ? "signup" : "signin",
	};
}

export const Route = createFileRoute("/login")({
	validateSearch: parseLoginSearch,
	head: () => ({
		meta: [{ title: "Sign in · printclub" }],
		// The Google button loads its script from this origin; connect early.
		links: googleSignInEnabled
			? [{ rel: "preconnect", href: "https://accounts.google.com" }]
			: [],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const showSignIn = search.mode !== "signup";

	useEffect(() => {
		window.scrollTo(0, 0);
	}, [search.mode]);

	return (
		<main className="auth-page auth-page--reference" id="main-content">
			<section className="auth-page__form" aria-label="Account access">
				<Link className="auth-page__brand" to="/">
					<span className="brand__mark">
						<img src="/printclub-mark.svg" alt="" aria-hidden="true" />
					</span>
					<span translate="no">printclub</span>
				</Link>
				<div
					key={showSignIn ? "signin" : "signup"}
					className="auth-page__form-inner swap-in"
				>
					{showSignIn ? (
						<SignInForm
							onSwitchToSignUp={() => {
								void navigate({
									search: (previous) => ({ ...previous, mode: "signup" }),
								});
							}}
							returnTo={search.returnTo}
						/>
					) : (
						<SignUpForm
							onSwitchToSignIn={() => {
								void navigate({
									search: (previous) => ({ ...previous, mode: "signin" }),
								});
							}}
							returnTo={search.returnTo}
						/>
					)}
				</div>
				<p className="auth-page__legal">
					Your designs save automatically in this browser and your photos are
					never uploaded.
				</p>
			</section>
			<aside className="auth-page__visual" aria-label="Printclub introduction">
				<div className="auth-page__quote-mark" aria-hidden="true">
					&ldquo;
				</div>
				<div className="auth-page__quote enter-stagger">
					<p className="eyebrow eyebrow--blue">A place for the good ones</p>
					<h2>Make room for the moments you keep returning to.</h2>
					<p>
						Turn a camera roll into a print worth holding onto, then pick up
						where you left off whenever you are ready.
					</p>
				</div>
				<div className="auth-page__prints" aria-hidden="true">
					<span className="auth-page__print auth-page__print--one" />
					<span className="auth-page__print auth-page__print--two" />
					<span className="auth-page__print auth-page__print--three" />
				</div>
			</aside>
		</main>
	);
}
