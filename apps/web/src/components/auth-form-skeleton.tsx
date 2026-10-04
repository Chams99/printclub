/** Holds the auth form's shape while the session check runs, so nothing jumps. */
export default function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
	return (
		<div className="auth-form-skeleton" role="status" aria-live="polite">
			<span className="sr-only">Checking your session…</span>
			<span className="auth-form-skeleton__line auth-form-skeleton__line--kicker" />
			<span className="auth-form-skeleton__line auth-form-skeleton__line--title" />
			<span className="auth-form-skeleton__line auth-form-skeleton__line--copy" />
			<span className="auth-form-skeleton__block" />
			{Array.from({ length: fields }, (_, index) => (
				<span key={index} className="auth-form-skeleton__field" />
			))}
			<span className="auth-form-skeleton__block auth-form-skeleton__block--primary" />
		</div>
	);
}
