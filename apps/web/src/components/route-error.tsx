import {
	type ErrorComponentProps,
	Link,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";

export function RouteError({ reset }: ErrorComponentProps) {
	const router = useRouter();
	const [retrying, setRetrying] = useState(false);
	const [retryError, setRetryError] = useState<string | null>(null);
	async function retry() {
		setRetrying(true);
		setRetryError(null);
		try {
			await router.invalidate();
			reset();
		} catch {
			setRetryError(
				"The page could not be reloaded. Check your connection and try again.",
			);
		} finally {
			setRetrying(false);
		}
	}
	return (
		<main className="not-found-page" id="main-content">
			<div className="not-found-page__inner" role="alert">
				<p className="eyebrow eyebrow--blue">Page unavailable</p>
				<h1>This page could not be opened.</h1>
				<p>
					Try again in a moment. Saved designs in this browser have been kept.
				</p>
				{retryError ? <p role="alert">{retryError}</p> : null}
				<div className="not-found-page__actions">
					<button
						className="button-v2 button-v2--primary"
						type="button"
						disabled={retrying}
						onClick={() => void retry()}
					>
						{retrying ? "Retrying…" : "Try again"}
					</button>
					<Link className="button-v2 button-v2--ghost" to="/">
						Return home
					</Link>
				</div>
			</div>
		</main>
	);
}
