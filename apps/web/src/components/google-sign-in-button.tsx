import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { authClient, googleSignInEnabled } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/form-error";
import { ENV } from "@/runtime-env";

type GoogleCredentialResponse = {
	credential: string;
};

type GoogleIdentityServices = {
	accounts: {
		id: {
			initialize: (options: {
				client_id: string;
				callback: (response: GoogleCredentialResponse) => void;
				cancel_on_tap_outside?: boolean;
			}) => void;
			renderButton: (
				parent: HTMLElement,
				options: {
					theme?: "outline" | "filled_blue" | "filled_black";
					size?: "small" | "medium" | "large";
					text?: "signin_with" | "signup_with" | "continue_with" | "signin";
					shape?: "rectangular" | "pill" | "circle" | "square";
					logo_alignment?: "left" | "center";
					locale?: string;
					width?: number;
				},
			) => void;
		};
	};
};

declare global {
	interface Window {
		google?: GoogleIdentityServices;
	}
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices() {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("Google sign-in requires a browser."));
	}
	if (window.google?.accounts.id) return Promise.resolve();
	if (googleScriptPromise) return googleScriptPromise;

	const script = document.createElement("script");
	script.src = "https://accounts.google.com/gsi/client?hl=en";
	script.async = true;
	script.defer = true;
	script.dataset.printclubGoogleIdentity = "true";

	googleScriptPromise = new Promise<void>((resolve, reject) => {
		script.addEventListener("load", () => {
			if (window.google?.accounts.id) resolve();
			else reject(new Error("Google Identity Services did not load."));
		});
		script.addEventListener("error", () =>
			reject(new Error("Google Identity Services could not load.")),
		);
		document.head.appendChild(script);
	}).catch((error) => {
		googleScriptPromise = null;
		throw error;
	});

	return googleScriptPromise;
}

export default function GoogleSignInButton({
	returnTo,
	onError,
	intent = "signin",
	onSuccess,
	showDivider = true,
}: {
	returnTo?: string;
	onError?: (message: string) => void;
	intent?: "signin" | "link";
	onSuccess?: () => void;
	showDivider?: boolean;
}) {
	const buttonRef = useRef<HTMLDivElement>(null);
	const pendingRef = useRef(false);
	const onErrorRef = useRef(onError);
	const returnToRef = useRef(returnTo);
	const intentRef = useRef(intent);
	const onSuccessRef = useRef(onSuccess);
	const [isPending, setIsPending] = useState(false);
	const [isLoading, setIsLoading] = useState(googleSignInEnabled);

	useEffect(() => {
		onErrorRef.current = onError;
		returnToRef.current = returnTo;
		intentRef.current = intent;
		onSuccessRef.current = onSuccess;
	}, [intent, onError, onSuccess, returnTo]);

	useEffect(() => {
		if (!googleSignInEnabled || !ENV.VITE_GOOGLE_CLIENT_ID) return;
		let disposed = false;
		let resizeObserver: ResizeObserver | null = null;

		const showError = (error: unknown) => {
			if (disposed) return;
			setIsLoading(false);
			const message = getAuthErrorMessage(
				error,
				"Google sign-in is unavailable right now. You can use email instead.",
			);
			onErrorRef.current?.(message);
		};

		const handleCredential = async ({
			credential,
		}: GoogleCredentialResponse) => {
			if (disposed || pendingRef.current || !credential) return;
			pendingRef.current = true;
			setIsPending(true);
			try {
				const response =
					intentRef.current === "link"
						? await authClient.linkSocial({
								provider: "google",
								idToken: { token: credential },
							})
						: await authClient.signIn.social({
								provider: "google",
								idToken: { token: credential },
							});
				if (response.error) {
					throw new Error(
						getAuthErrorMessage(
							{ error: response.error },
							intentRef.current === "link"
								? "Google account linking failed."
								: "Google sign-in failed.",
						),
					);
				}
				if (intentRef.current === "link") {
					onSuccessRef.current?.();
				} else {
					window.location.assign(returnToRef.current ?? "/dashboard");
				}
			} catch (error) {
				const message = getAuthErrorMessage(
					error,
					"Google sign-in failed. Try again or use email instead.",
				);
				onErrorRef.current?.(message);
				toast.error(message);
				pendingRef.current = false;
				setIsPending(false);
			}
		};

		loadGoogleIdentityServices()
			.then(() => {
				if (disposed || !buttonRef.current || !window.google?.accounts.id) {
					return;
				}
				window.google.accounts.id.initialize({
					client_id: ENV.VITE_GOOGLE_CLIENT_ID as string,
					callback: handleCredential,
					cancel_on_tap_outside: true,
				});
				const renderGoogleButton = () => {
					if (disposed || !buttonRef.current || !window.google?.accounts.id) {
						return;
					}
					buttonRef.current.replaceChildren();
					const availableWidth =
						buttonRef.current.parentElement?.clientWidth ??
						buttonRef.current.clientWidth;
					window.google.accounts.id.renderButton(buttonRef.current, {
						theme: "outline",
						size: "large",
						text: "continue_with",
						shape: "rectangular",
						logo_alignment: "left",
						locale: "en",
						width: Math.min(Math.max(availableWidth, 200), 400),
					});
				};

				renderGoogleButton();
				const resizeTarget = buttonRef.current.parentElement;
				resizeObserver =
					typeof ResizeObserver === "undefined" || !resizeTarget
						? null
						: new ResizeObserver(() => renderGoogleButton());
				if (resizeObserver && resizeTarget)
					resizeObserver.observe(resizeTarget);
				setIsLoading(false);
			})
			.catch(showError);

		return () => {
			disposed = true;
			resizeObserver?.disconnect();
			buttonRef.current?.replaceChildren();
		};
	}, []);

	if (!googleSignInEnabled) return null;

	return (
		<>
			<div className="auth-google-button" aria-busy={isLoading || isPending}>
				<div ref={buttonRef} className="auth-google-button__mount" />
				{isLoading ? (
					<span className="auth-google-button__status">
						Loading Google sign-in…
					</span>
				) : null}
				{isPending ? (
					<span className="auth-google-button__status" role="status">
						{intent === "link"
							? "Connecting Google…"
							: "Signing in with Google…"}
					</span>
				) : null}
			</div>
			{showDivider ? (
				<div className="auth-form-card__divider" aria-hidden="true">
					<span>or continue with email</span>
				</div>
			) : null}
		</>
	);
}
