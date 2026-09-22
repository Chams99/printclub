import { Button } from "@PhotoPrinting/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import GoogleSignInButton from "@/components/google-sign-in-button";
import { authClient, googleSignInEnabled } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/form-error";

export const Route = createFileRoute("/_auth/account")({
	component: AccountPage,
});

type LinkedAccount = {
	id: string;
	providerId: string;
};

function AccountPage() {
	const { session } = Route.useRouteContext();
	const user = session.data?.user;
	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isResending, setIsResending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const loadAccounts = useCallback(async () => {
		setIsLoading(true);
		const result = await authClient.listAccounts();
		if (result.error) {
			setError(
				getAuthErrorMessage(
					result,
					"We couldn't load your sign-in methods. Try again.",
				),
			);
		} else {
			setAccounts(result.data ?? []);
		}
		setIsLoading(false);
	}, []);

	useEffect(() => {
		void loadAccounts();
	}, [loadAccounts]);

	async function resendVerification() {
		if (!user?.email) return;
		setIsResending(true);
		setError(null);
		setMessage(null);
		const result = await authClient.sendVerificationEmail({
			email: user.email,
			callbackURL: `${window.location.origin}/account?verified=1`,
		});
		setIsResending(false);
		if (result.error) {
			setError(
				getAuthErrorMessage(
					result,
					"We couldn't send the verification email. Try again in a moment.",
				),
			);
			return;
		}
		setMessage("Verification email sent. Check your inbox and spam folder.");
	}

	const googleLinked = accounts.some(
		(account) => account.providerId === "google",
	);

	return (
		<main className="account-page" id="main-content">
			<div className="account-shell account-settings">
				<p className="eyebrow">Account settings</p>
				<h1>Your sign-in methods</h1>
				<p className="account-lede">
					Connect Google after you have signed in so both methods open the same
					printclub account. We never merge accounts just because an email looks
					the same.
				</p>

				{error ? (
					<div className="auth-form-card__alert" role="alert">
						<CircleAlert aria-hidden="true" />
						<span>{error}</span>
					</div>
				) : null}
				{message ? (
					<div className="auth-form-card__success" role="status">
						<CircleCheck aria-hidden="true" />
						<span>{message}</span>
					</div>
				) : null}

				<section
					className="account-settings__section"
					aria-labelledby="email-title"
				>
					<div className="account-settings__heading">
						<div>
							<p className="eyebrow">Email and password</p>
							<h2 id="email-title">{user?.email}</h2>
						</div>
						<ShieldCheck aria-hidden="true" />
					</div>
					<p>
						{user?.emailVerified
							? "Your email is verified."
							: "Verify this email before connecting another sign-in method."}
					</p>
					{!user?.emailVerified ? (
						<Button
							type="button"
							variant="outline"
							disabled={isResending}
							onClick={() => void resendVerification()}
						>
							{isResending ? "Sending…" : "Send verification email"}
						</Button>
					) : null}
				</section>

				<section
					className="account-settings__section"
					aria-labelledby="connected-title"
				>
					<div className="account-settings__heading">
						<div>
							<p className="eyebrow">Connected accounts</p>
							<h2 id="connected-title">Google</h2>
						</div>
						<span className="account-settings__status">
							{isLoading
								? "Checking…"
								: googleLinked
									? "Connected"
									: "Not connected"}
						</span>
					</div>
					<p>
						{googleLinked
							? "You can use Google to sign in to this account."
							: "Connect Google only after verifying your printclub email."}
					</p>
					{!googleLinked && user?.emailVerified && googleSignInEnabled ? (
						<GoogleSignInButton
							intent="link"
							showDivider={false}
							onSuccess={() => {
								setMessage("Google is now connected to your account.");
								void loadAccounts();
							}}
							onError={(nextError) => setError(nextError)}
						/>
					) : null}
					{!googleLinked && !user?.emailVerified ? (
						<p className="account-settings__muted">
							Verify your email to unlock Google connection.
						</p>
					) : null}
					{!googleSignInEnabled ? (
						<p className="account-settings__muted">
							Google sign-in is not configured in this environment.
						</p>
					) : null}
				</section>

				<Link className="text-link-v2" to="/dashboard">
					Back to dashboard
				</Link>
			</div>
		</main>
	);
}
