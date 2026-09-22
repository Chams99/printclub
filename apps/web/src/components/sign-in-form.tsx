import { Button } from "@PhotoPrinting/ui/components/button";
import { Input } from "@PhotoPrinting/ui/components/input";
import { Label } from "@PhotoPrinting/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import {
	getAuthErrorCode,
	getAuthErrorMessage,
	getFormErrorMessage,
} from "@/lib/form-error";
import {
	formatVerificationCooldown,
	useVerificationResendCooldown,
} from "@/lib/verification-resend";

import GoogleSignInButton from "./google-sign-in-button";
import Loader from "./loader";

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
	const { isPending } = authClient.useSession();
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

	async function resendVerificationEmail() {
		if (!verificationEmail || isCoolingDown) return;
		setIsResending(true);
		setFormError(null);
		const result = await authClient.sendVerificationEmail({
			email: verificationEmail,
			callbackURL: `${window.location.origin}${returnTo ?? "/dashboard"}`,
		});
		setIsResending(false);
		if (result.error) {
			const message = getAuthErrorMessage(
				result,
				"We couldn't resend the verification email. Try again in a moment.",
			);
			setFormError(message);
			toast.error(message);
			return;
		}
		setFormError(null);
		startCooldown();
		toast.success("Verification email sent. Check your inbox and spam folder.");
	}

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			try {
				setVerificationEmail(null);
				await authClient.signIn.email(
					{
						email: value.email,
						password: value.password,
					},
					{
						onSuccess: () => {
							if (returnTo) window.location.assign(returnTo);
							else navigate({ to: "/dashboard" });
							toast.success("Sign in successful");
						},
						onError: (error) => {
							if (getAuthErrorCode(error) === "EMAIL_NOT_VERIFIED") {
								setVerificationEmail(value.email.trim());
							}
							const message = getAuthErrorMessage(
								error,
								"Sign in failed. Check your email and password and try again.",
							);
							setFormError(message);
							toast.error(message);
							window.requestAnimationFrame(() => formErrorRef.current?.focus());
						},
					},
				);
			} catch (error) {
				const message = getAuthErrorMessage(
					error,
					"Connection problem. Check your internet connection, then try again.",
				);
				setFormError(message);
				toast.error(message);
				window.requestAnimationFrame(() => formErrorRef.current?.focus());
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

	if (isPending) {
		return <Loader />;
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
					{verificationEmail ? (
						<Button
							type="button"
							variant="link"
							className="auth-form-card__alert-action"
							disabled={isResending || isCoolingDown}
							onClick={() => void resendVerificationEmail()}
						>
							{isResending
								? "Sending…"
								: isCoolingDown
									? `Resend in ${formatVerificationCooldown(secondsRemaining)}`
									: "Resend verification"}
						</Button>
					) : null}
				</div>
			) : null}
			<GoogleSignInButton
				returnTo={returnTo}
				onError={(message) => {
					setFormError(message);
					window.requestAnimationFrame(() => formErrorRef.current?.focus());
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
					className={
						showValidationErrors
							? "auth-form-card__field-wrap has-error"
							: "auth-form-card__field-wrap"
					}
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
										setFieldErrors((current) => ({
											...current,
											email: undefined,
										}));
									}}
								/>
								{!showValidationErrors && field.state.meta.errors.length ? (
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
					{showValidationErrors ? (
						<p
							id="email-error"
							className="auth-form-card__error"
							aria-live="polite"
						>
							<CircleAlert aria-hidden="true" />
							<span>Enter a valid email address.</span>
						</p>
					) : null}
				</div>

				<div
					className={
						showValidationErrors
							? "auth-form-card__field-wrap has-error"
							: "auth-form-card__field-wrap"
					}
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
								<Input
									id={field.name}
									name={field.name}
									type="password"
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
										setFieldErrors((current) => ({
											...current,
											password: undefined,
										}));
									}}
								/>
								{!showValidationErrors && field.state.meta.errors.length ? (
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
					{showValidationErrors ? (
						<p
							id="password-error"
							className="auth-form-card__error"
							aria-live="polite"
						>
							<CircleAlert aria-hidden="true" />
							<span>Password must be at least 8 characters.</span>
						</p>
					) : null}
				</div>

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
							{isSubmitting ? "Submitting…" : "Sign In"}
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
					Need an account? Sign Up
				</Button>
			</div>
		</div>
	);
}
