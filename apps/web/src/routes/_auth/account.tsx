import { Button } from "@PhotoPrinting/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import GoogleSignInButton from "@/components/google-sign-in-button";
import {
	TurnstileChallenge,
	useTurnstile,
} from "@/components/turnstile-challenge";
import WorkspaceNav from "@/components/workspace-nav";
import { authClient, googleSignInEnabled } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/form-error";
import {
	formatVerificationCooldown,
	useVerificationResendCooldown,
} from "@/lib/verification-resend";

export const Route = createFileRoute("/_auth/account")({
	head: () => ({ meta: [{ title: "Account settings · printclub" }] }),
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
	const [accountsLoadError, setAccountsLoadError] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const { isCoolingDown, secondsRemaining, startCooldown } =
		useVerificationResendCooldown();
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const messageRef = useRef<HTMLDivElement>(null);
	const turnstile = useTurnstile("send-verification-email");

	function focusMessage() {
		window.requestAnimationFrame(() => messageRef.current?.focus());
	}

	const loadAccounts = useCallback(async () => {
		setIsLoading(true);
		setAccountsLoadError(false);
		try {
			const result = await authClient.listAccounts();
			if (result.error) {
				setAccountsLoadError(true);
				setError(
					getAuthErrorMessage(
						result,
						"We couldn't load your sign-in methods. Try again.",
					),
				);
			} else {
				setAccounts(result.data ?? []);
				setError(null);
			}
		} catch (loadError) {
			setAccountsLoadError(true);
			setError(
				getAuthErrorMessage(
					loadError,
					"We couldn't load your sign-in methods. Check your connection and retry.",
				),
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadAccounts();
	}, [loadAccounts]);

	async function resendVerification() {
		if (!user?.email || isCoolingDown) return;
		if (turnstile.enabled && !turnstile.token) {
			setError(
				turnstile.loadError
					? "The security check could not load. Check your connection and try again."
					: "Complete the security check before requesting another email.",
			);
			focusMessage();
			return;
		}
		setIsResending(true);
		setError(null);
		setMessage(null);
		try {
			const result = await authClient.sendVerificationEmail(
				{
					email: user.email,
					callbackURL: `${window.location.origin}/account?verified=1`,
				},
				turnstile.token
					? { headers: { "X-Printclub-Turnstile": turnstile.token } }
					: undefined,
			);
			if (result.error) {
				setError(
					getAuthErrorMessage(
						result,
						"We couldn't send the verification email. Try again in a moment.",
					),
				);
				focusMessage();
				return;
			}
			setMessage("Verification email sent. Check your inbox and spam folder.");
		} catch (sendError) {
			setError(
				getAuthErrorMessage(
					sendError,
					"We couldn't send the verification email. Check your connection and try again.",
				),
			);
			focusMessage();
		} finally {
			startCooldown();
			turnstile.reset();
			setIsResending(false);
		}
	}

	const googleLinked = accounts.some(
		(account) => account.providerId === "google",
	);

	const initials = (user?.name ?? "")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part: string) => part[0]?.toUpperCase())
		.join("");
	const memberSince = user?.createdAt
		? new Intl.DateTimeFormat(undefined, {
				month: "long",
				year: "numeric",
			}).format(new Date(user.createdAt))
		: null;

	return (
		<main className="account-page workspace-page" id="main-content">
			<div className="account-shell account-settings enter-stagger">
				<WorkspaceNav />
				<header className="workspace-heading">
					<p className="eyebrow">Account settings</p>
					<h1>Your sign-in methods</h1>
					<p className="account-lede">
						Connect Google after you have signed in so both methods open the
						same printclub account. We never merge accounts just because an
						email looks the same.
					</p>
				</header>

				{user ? (
					<section className="account-profile" aria-label="Signed-in profile">
						<span className="account-profile__avatar" aria-hidden="true">
							{initials || "?"}
						</span>
						<span className="account-profile__details">
							<strong>{user.name}</strong>
							<span>{user.email}</span>
						</span>
						{memberSince ? (
							<span className="account-profile__since">
								Member since {memberSince}
							</span>
						) : null}
					</section>
				) : null}

				{error ? (
					<div
						ref={messageRef}
						className="auth-form-card__alert"
						role="alert"
						tabIndex={-1}
					>
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
						<span
							className="account-settings__status"
							data-state={user?.emailVerified ? "positive" : "attention"}
						>
							{user?.emailVerified ? "Verified" : "Not verified"}
						</span>
					</div>
					<p>
						{user?.emailVerified
							? "Your email is verified."
							: "Verify this email before connecting another sign-in method."}
					</p>
					{!user?.emailVerified ? (
						<>
							<TurnstileChallenge challenge={turnstile} />
							<Button
								type="button"
								variant="outline"
								disabled={isResending || isCoolingDown}
								onClick={() => void resendVerification()}
							>
								{isResending
									? "Sending…"
									: isCoolingDown
										? `Resend in ${formatVerificationCooldown(secondsRemaining)}`
										: "Send verification email"}
							</Button>
						</>
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
						<span
							className="account-settings__status"
							data-state={
								isLoading ? undefined : googleLinked ? "positive" : "idle"
							}
						>
							{isLoading
								? "Checking…"
								: accountsLoadError
									? "Unable to check"
									: googleLinked
										? "Connected"
										: "Not connected"}
						</span>
					</div>
					<p>
						{googleLinked
							? "You can use Google to sign in to this account."
							: user?.emailVerified
								? "Connect Google to sign in to this same account with either method."
								: "Connect Google only after verifying your printclub email."}
					</p>
					{accountsLoadError ? (
						<Button
							type="button"
							variant="outline"
							disabled={isLoading}
							onClick={() => void loadAccounts()}
						>
							{isLoading ? "Checking…" : "Retry"}
						</Button>
					) : null}
					{!googleLinked && user?.emailVerified && googleSignInEnabled ? (
						<GoogleSignInButton
							intent="link"
							showDivider={false}
							onSuccess={() => {
								setMessage("Google is now connected to your account.");
								void loadAccounts();
							}}
							onError={(nextError) => {
								setError(nextError);
								focusMessage();
							}}
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
			</div>
		</main>
	);
}
