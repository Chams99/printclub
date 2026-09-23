import { Button } from "@PhotoPrinting/ui/components/button";
import { Input } from "@PhotoPrinting/ui/components/input";
import { Label } from "@PhotoPrinting/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage, getFormErrorMessage } from "@/lib/form-error";
import { ENV } from "@/runtime-env";

import GoogleSignInButton from "./google-sign-in-button";
import Loader from "./loader";

export default function SignUpForm({
	onSwitchToSignIn,
	returnTo,
}: {
	onSwitchToSignIn: () => void;
	returnTo?: string;
}) {
	const { isPending } = authClient.useSession();
	const [formError, setFormError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<
		Partial<Record<"name" | "email" | "password", string>>
	>({});
	const [showValidationErrors, setShowValidationErrors] = useState(false);
	const formErrorRef = useRef<HTMLDivElement>(null);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			name: "",
		},
		onSubmit: async ({ value }) => {
			try {
				setFormError(null);
				setSuccessMessage(null);
				await authClient.signUp.email(
					{
						email: value.email,
						password: value.password,
						name: value.name,
						callbackURL: `${window.location.origin}${returnTo ?? "/dashboard"}`,
					},
					{
						onSuccess: () => {
							setSuccessMessage(
								ENV.NODE_ENV === "development" &&
									window.location.hostname === "localhost"
									? "If this address already belongs to a Google account, no email is sent—use Continue with Google above. For a new address, the API terminal has the verification link."
									: "If this address already belongs to a Google account, no email is sent—use Continue with Google above. For a new address, check your inbox and spam folder for the verification email.",
							);
							toast.success(
								ENV.NODE_ENV === "development" &&
									window.location.hostname === "localhost"
									? "Use Google or check the API terminal"
									: "Use Google or check your inbox",
							);
						},
						onError: (error) => {
							const message = getAuthErrorMessage(
								error,
								"We couldn't create your account. Check your details and try again.",
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
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	function validateFields(formElement: HTMLFormElement) {
		const nextErrors: Partial<Record<"name" | "email" | "password", string>> =
			{};
		const name = (
			formElement.elements.namedItem("name") as HTMLInputElement
		).value.trim();
		const email = (
			formElement.elements.namedItem("email") as HTMLInputElement
		).value.trim();
		const password = (
			formElement.elements.namedItem("password") as HTMLInputElement
		).value;
		if (name.length < 2) nextErrors.name = "Enter at least 2 characters.";
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
		setFormError(
			"We can't create your account yet. Fix the highlighted fields below.",
		);
		const firstInvalid = nextErrors.name
			? "name"
			: nextErrors.email
				? "email"
				: "password";
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
				<p className="auth-form-card__kicker">Start a printclub account</p>
				<h1>Create your account</h1>
				<p>
					Keep your designs close and return to them whenever you are ready.
				</p>
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
			{successMessage ? (
				<div className="auth-form-card__success" role="status">
					<CircleCheck
						className="auth-form-card__success-icon"
						aria-hidden="true"
					/>
					<div className="auth-form-card__success-body">
						<strong>Next step</strong>
						<span>{successMessage}</span>
					</div>
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
					<form.Field name="name" key={`name-${fieldErrors.name ?? "valid"}`}>
						{(field) => (
							<div
								className={
									fieldErrors.name || field.state.meta.errors.length
										? "auth-form-card__field has-error"
										: "auth-form-card__field"
								}
							>
								<Label htmlFor={field.name}>Name</Label>
								<Input
									id={field.name}
									name={field.name}
									autoComplete="name"
									aria-invalid={Boolean(
										fieldErrors.name || field.state.meta.errors.length,
									)}
									aria-describedby={
										fieldErrors.name || field.state.meta.errors.length
											? `${field.name}-error`
											: undefined
									}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => {
										field.handleChange(e.target.value);
										setFieldErrors((current) => ({
											...current,
											name: undefined,
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
											{fieldErrors.name ||
												getFormErrorMessage(field.state.meta.errors[0])}
										</span>
									</p>
								) : null}
							</div>
						)}
					</form.Field>
					{showValidationErrors ? (
						<p
							id="name-error"
							className="auth-form-card__error"
							aria-live="polite"
						>
							<CircleAlert aria-hidden="true" />
							<span>Enter at least 2 characters.</span>
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
									autoComplete="new-password"
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
							{isSubmitting ? "Submitting…" : "Sign Up"}
						</button>
					)}
				</form.Subscribe>
			</form>

			<div className="auth-form-card__switch">
				<Button
					variant="link"
					onClick={onSwitchToSignIn}
					className="auth-form-card__switch-button"
				>
					Already have an account? Sign In
				</Button>
			</div>
		</div>
	);
}
