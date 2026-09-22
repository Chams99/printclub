import { useEffect, useState } from "react";

export const verificationResendCooldownSeconds = 5 * 60;

export function formatVerificationCooldown(seconds: number) {
	if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`;
	return `${seconds}s`;
}

export function useVerificationResendCooldown() {
	const [retryAt, setRetryAt] = useState(0);
	const [now, setNow] = useState(0);

	useEffect(() => {
		if (!retryAt) {
			setNow(Date.now());
			return;
		}

		const update = () => setNow(Date.now());
		update();
		const timer = window.setInterval(update, 1_000);
		return () => window.clearInterval(timer);
	}, [retryAt]);

	const secondsRemaining = Math.max(0, Math.ceil((retryAt - now) / 1_000));

	return {
		secondsRemaining,
		isCoolingDown: secondsRemaining > 0,
		startCooldown: () => {
			const nextRetryAt =
				Date.now() + verificationResendCooldownSeconds * 1_000;
			setNow(Date.now());
			setRetryAt(nextRetryAt);
		},
	};
}
