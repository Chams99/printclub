import { Button } from "@PhotoPrinting/ui/components/button";
import { Input } from "@PhotoPrinting/ui/components/input";
import { Label } from "@PhotoPrinting/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import {
	getAuthErrorMessage,
	getFormErrorMessage,
	isVerificationEmailFailure,
} from "@/lib/form-error";
import {
	formatVerificationCooldown,
	useVerificationResendCooldown,
} from "@/lib/verification-resend";

import GoogleSignInButton from "./google-sign-in-button";
import PasswordInput from "./password-input";
import { TurnstileChallenge, useTurnstile } from "./turnstile-challenge";

export default function SignInForm({
	onSwitchToSignUp,
	returnTo,
}: {
	onSwitchToSignUp: () => void;
	returnTo?: string;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const [formError, setFormError] = useState<string | null>(null);
	const [verificationEmail, setVerificationEmail] = useState<string | null>(
		null,
	);
	const [isResending, setIsResending] = useState(false);
	const { isCoolingDown, secondsRemaining, startCooldown } =
		useVerificationResendCooldown();
	const [fieldErrors, setFieldErrors] = useState<
		Partial<Record<"email" | "password", string>>
	>({});
	const [showValidationErrors, setShowValidationErrors] = useState(false);
	const formErrorRef = useRef<HTMLDivElement>(null);
	const turnstile = useTurnstile("sign-in");
	const resendTurnstile = useTurnstile("send-verification-email");

	function focusFormError() {
		window.requestAnimationFrame(() => formErrorRef.current?.focus());
	}

	async function resendVerificationEmail() {
		if (!verificationEmail || isCoolingDown) return;
		if (resendTurnstile.enabled && !resendTurnstile.token) {
			setFormError(
				resendTurnstile.loadError
					? "The security check could not load. Check your connection and try again."
					: "Complete the security check before requesting another email.",
			);
			focusFormError();
			return;
		}
		setIsResending(true);
		setFormError(null);
		try {
			const result = await authClient.sendVerificationEmail(
				{
					email: verificationEmail,
					callbackURL: `${window.location.origin}${returnTo ?? "/dashboard"}`,
				},
				resendTurnstile.token
					? {
							headers: {
								"X-Printclub-Turnstile": resendTurnstile.token,
							},
						}
					: undefined,
			);
			if (result.error) {
				const message = getAuthErrorMessage(
					result,
					"We couldn't resend the verification email. Try again in a moment.",
				);
				setFormError(message);
				if (isVerificationEmailFailure(result)) startCooldown();
				toast.error(message);
				focusFormError();
				return;
			}
			setFormError(null);
			toast.success(
				"Verification email sent. Check your inbox and spam folder.",
			);
		} catch (error) {
			const message = getAuthErrorMessage(
				error,
				"We couldn't resend the verification email. Check your connection and try again.",
			);
			setFormError(message);
			toast.error(message);
			focusFormError();
		} finally {
			startCooldown();
			resendTurnstile.reset();
			setIsResending(false);
		}
	}

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			if (turnstile.enabled && !turnstile.token) {
				setFormError(
					turnstile.loadError
						? "The security check could not load. Check your connection and try again."
						: "Complete the security check before signing in.",
				);
				focusFormError();
				return;
			}
			try {
				setVerificationEmail(null);
				await authClient.signIn.email(
					{
						email: value.email,
						password: value.password,
					},
					{
						...(turnstile.token
							? {
									headers: {
										"X-Printclub-Turnstile": turnstile.token,
									},
								}
							: {}),
						onSuccess: () => {
							if (returnTo) window.location.assign(returnTo);
							else navigate({ to: "/dashboard" });
							toast.success("Sign in successful");
						},
						onError: (error) => {
							if (isVerificationEmailFailure(error)) {
								setVerificationEmail(value.email.trim());
								startCooldown();
							}
							const message = getAuthErrorMessage(
								error,
								"Sign in failed. Check your email and password and try again.",
							);
							setFormError(message);
							toast.error(message);
							focusFormError();
						},
					},
				);
				turnstile.reset();
			} catch (error) {
				turnstile.reset();
				const message = getAuthErrorMessage(
					error,
					"Connection problem. Check your internet connection, then try again.",
				);
				setFormError(message);
				toast.error(message);
				focusFormError();
			}
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	function validateFields(formElement: HTMLFormElement) {
		const nextErrors: Partial<Record<"email" | "password", string>> = {};
		const email = (
			formElement.elements.namedItem("email") as HTMLInputElement
		).value.trim();
		const password = (
			formElement.elements.namedItem("password") as HTMLInputElement
		).value;
		if (!/^\S+@\S+\.\S+$/.test(email)) {
			nextErrors.email = "Enter a valid email address.";
		}
		if (password.length < 8) {
			nextErrors.password = "Password must be at least 8 characters.";
		}
		if (Object.keys(nextErrors).length === 0) {
			setFieldErrors({});
			setShowValidationErrors(false);
			return true;
		}
		setFieldErrors(nextErrors);
		setShowValidationErrors(true);
		setFormError("We can't sign you in yet. Fix the highlighted fields below.");
		const firstInvalid = nextErrors.email ? "email" : "password";
		window.requestAnimationFrame(() =>
			document.getElementById(firstInvalid)?.focus(),
		);
		return false;
	}

	return (
		<div className="auth-form-card">
			<div className="auth-form-card__heading">
				<p className="auth-form-card__kicker">Welcome back</p>
				<h1>Sign in to printclub</h1>
				<p>Pick up a saved design, request a proof, or keep creating.</p>
			</div>
			{formError ? (
				<div
					ref={formErrorRef}
					className="auth-form-card__alert"
					role="alert"
					aria-live="assertive"
					tabIndex={-1}
				>
					<CircleAlert aria-hidden="true" />
					<span>{formError}</span>
				</div>
			) : null}
			{verificationEmail ? (
				<div className="auth-form-card__verification-resend">
					<p>
						{isCoolingDown
							? "A verification email was just requested. Check your inbox and spam folder; you can request another after the cooldown."
							: "Need a fresh verification link? Complete this check, then resend."}
					</p>
					{!isCoolingDown ? (
						<TurnstileChallenge challenge={resendTurnstile} />
					) : null}
					<Button
						type="button"
						variant="outline"
						disabled={isResending || isCoolingDown}
						onClick={() => void resendVerificationEmail()}
					>
						{isResending
							? "Sending…"
							: isCoolingDown
								? `Resend in ${formatVerificationCooldown(secondsRemaining)}`
								: "Resend verification email"}
					</Button>
				</div>
			) : null}
			<GoogleSignInButton
				returnTo={returnTo}
				onError={(message) => {
					setFormError(message);
					focusFormError();
				}}
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					if (!validateFields(e.currentTarget)) return;
					form.handleSubmit();
				}}
				className="auth-form-card__fields"
			>
				<div
					className={`auth-form-card__field-wrap${fieldErrors.email ? " has-error" : ""}`}
				>
					<form.Field
						name="email"
						key={`email-${fieldErrors.email ?? "valid"}`}
					>
						{(field) => (
							<div
								className={
									fieldErrors.email || field.state.meta.errors.length
										? "auth-form-card__field has-error"
										: "auth-form-card__field"
								}
							>
								<Label htmlFor={field.name}>Email</Label>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									autoComplete="email"
									spellCheck={false}
									aria-invalid={Boolean(
										fieldErrors.email || field.state.meta.errors.length,
									)}
									aria-describedby={
										fieldErrors.email || field.state.meta.errors.length
											? `${field.name}-error`
											: undefined
									}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										field.handleChange(e.target.value);
										setFormError(null);
										setVerificationEmail(null);
										setFieldErrors((current) => ({
											...current,
											email: undefined,
										}));
									}}
								/>
								{fieldErrors.email ||
								(!showValidationErrors && field.state.meta.errors.length) ? (
									<p
										id={`${field.name}-error`}
										className="auth-form-card__error"
										aria-live="polite"
									>
										<CircleAlert aria-hidden="true" />
										<span>
											{fieldErrors.email ||
												getFormErrorMessage(field.state.meta.errors[0])}
										</span>
									</p>
								) : null}
							</div>
						)}
					</form.Field>
				</div>

				<div
					className={`auth-form-card__field-wrap${fieldErrors.password ? " has-error" : ""}`}
				>
					<form.Field
						name="password"
						key={`password-${fieldErrors.password ?? "valid"}`}
					>
						{(field) => (
							<div
								className={
									fieldErrors.password || field.state.meta.errors.length
										? "auth-form-card__field has-error"
										: "auth-form-card__field"
								}
							>
								<Label htmlFor={field.name}>Password</Label>
								<PasswordInput
									id={field.name}
									name={field.name}
									autoComplete="current-password"
									aria-invalid={Boolean(
										fieldErrors.password || field.state.meta.errors.length,
									)}
									aria-describedby={
										fieldErrors.password || field.state.meta.errors.length
											? `${field.name}-error`
											: undefined
									}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										field.handleChange(e.target.value);
										setFormError(null);
										setFieldErrors((current) => ({
											...current,
											password: undefined,
										}));
									}}
								/>
								{fieldErrors.password ||
								(!showValidationErrors && field.state.meta.errors.length) ? (
									<p
										id={`${field.name}-error`}
										className="auth-form-card__error"
										aria-live="polite"
									>
										<CircleAlert aria-hidden="true" />
										<span>
											{fieldErrors.password ||
												getFormErrorMessage(field.state.meta.errors[0])}
										</span>
									</p>
								) : null}
							</div>
						)}
					</form.Field>
				</div>

				<TurnstileChallenge challenge={turnstile} />

				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<button
							data-slot="button"
							type="submit"
							className="auth-form-card__submit w-full"
							disabled={isSubmitting}
							aria-busy={isSubmitting}
							onClick={(event) => {
								if (
									event.currentTarget.form &&
									!validateFields(event.currentTarget.form)
								) {
									event.preventDefault();
									event.stopPropagation();
									return;
								}
							}}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="button-spinner" aria-hidden="true" />
									Signing in…
								</>
							) : (
								"Sign in"
							)}
						</button>
					)}
				</form.Subscribe>
			</form>

			<div className="auth-form-card__switch">
				<Button
					variant="link"
					onClick={onSwitchToSignUp}
					className="auth-form-card__switch-button"
				>
					Need an account? Sign up
				</Button>
			</div>
		</div>
	);
}
