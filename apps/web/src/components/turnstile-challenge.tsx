import { useCallback, useEffect, useRef, useState } from "react";

import { ENV } from "@/runtime-env";

type TurnstileApi = {
	render: (
		container: HTMLElement,
		options: {
			sitekey: string;
			action: string;
			callback: (token: string) => void;
			"expired-callback": () => void;
			"error-callback": () => void;
			theme: "light";
		},
	) => string | number;
	reset: (widgetId?: string | number) => void;
	remove: (widgetId?: string | number) => void;
};

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	if (scriptPromise) return scriptPromise;

	scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			"script[data-printclub-turnstile]",
		);
		const script = existing ?? document.createElement("script");
		const onLoad = () => {
			if (window.turnstile) resolve(window.turnstile);
			else reject(new Error("Turnstile did not initialize"));
		};
		const onError = () => reject(new Error("Turnstile could not load"));
		script.addEventListener("load", onLoad, { once: true });
		script.addEventListener("error", onError, { once: true });
		if (!existing) {
			script.async = true;
			script.defer = true;
			script.src =
				"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
			script.dataset.printclubTurnstile = "true";
			document.head.appendChild(script);
		}
	});
	return scriptPromise;
}

export function useTurnstile(action: string) {
	const siteKey = ENV.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetRef = useRef<string | number | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [loadError, setLoadError] = useState(false);

	useEffect(() => {
		if (!siteKey || !containerRef.current) return;
		let disposed = false;
		void loadTurnstile()
			.then((turnstile) => {
				if (disposed || !containerRef.current) return;
				widgetRef.current = turnstile.render(containerRef.current, {
					sitekey: siteKey,
					action,
					callback: (nextToken) => setToken(nextToken),
					"expired-callback": () => setToken(null),
					"error-callback": () => {
						setToken(null);
						setLoadError(true);
					},
					theme: "light",
				});
				setReady(true);
			})
			.catch(() => {
				if (!disposed) setLoadError(true);
			});

		return () => {
			disposed = true;
			if (widgetRef.current !== null && window.turnstile) {
				window.turnstile.remove(widgetRef.current);
			}
			widgetRef.current = null;
		};
	}, [action, siteKey]);

	const reset = useCallback(() => {
		setToken(null);
		if (widgetRef.current !== null) window.turnstile?.reset(widgetRef.current);
	}, []);

	return {
		enabled: Boolean(siteKey),
		ready,
		loadError,
		token,
		containerRef,
		reset,
	};
}

export type TurnstileState = ReturnType<typeof useTurnstile>;

export function TurnstileChallenge({
	challenge,
}: {
	challenge: TurnstileState;
}) {
	if (!challenge.enabled) return null;
	return (
		<div className="turnstile-challenge" aria-live="polite">
			<div ref={challenge.containerRef} />
			{challenge.loadError ? (
				<p className="turnstile-challenge__message">
					The security check could not load. Check your connection and try
					again.
				</p>
			) : !challenge.ready ? (
				<p className="turnstile-challenge__message">Loading security check…</p>
			) : null}
		</div>
	);
}
