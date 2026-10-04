import { Button } from "@PhotoPrinting/ui/components/button";
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
			size: "flexible";
			appearance: "always";
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

	const promise = new Promise<TurnstileApi>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			"script[data-printclub-turnstile]",
		);
		const script = existing ?? document.createElement("script");
		let settled = false;
		const timeout = window.setTimeout(() => fail(), 15_000);
		const cleanup = () => {
			window.clearTimeout(timeout);
			script.removeEventListener("load", onLoad);
			script.removeEventListener("error", onError);
		};
		const fail = () => {
			if (settled) return;
			settled = true;
			cleanup();
			if (script.dataset.printclubTurnstile === "true") script.remove();
			if (scriptPromise === promise) scriptPromise = null;
			reject(new Error("Turnstile could not load"));
		};
		const onLoad = () => {
			if (settled) return;
			if (!window.turnstile) return fail();
			settled = true;
			cleanup();
			resolve(window.turnstile);
		};
		const onError = () => fail();
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
	scriptPromise = promise;
	return promise;
}

export function useTurnstile(action: string) {
	const siteKey = ENV.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const widgetRef = useRef<string | number | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [ready, setReady] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const [expired, setExpired] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const containerRef = useCallback((node: HTMLDivElement | null) => {
		setContainer(node);
	}, []);

	useEffect(() => {
		if (!siteKey || !container) return;
		let disposed = false;
		void loadTurnstile()
			.then((turnstile) => {
				if (disposed) return;
				widgetRef.current = turnstile.render(container, {
					sitekey: siteKey,
					action,
					callback: (nextToken) => {
						setToken(nextToken);
						setExpired(false);
						setLoadError(false);
					},
					"expired-callback": () => {
						setToken(null);
						setExpired(true);
					},
					"error-callback": () => {
						setToken(null);
						setLoadError(true);
					},
					theme: "light",
					size: "flexible",
					appearance: "always",
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
	}, [action, container, siteKey]);

	const reset = useCallback(() => {
		setToken(null);
		if (widgetRef.current !== null) window.turnstile?.reset(widgetRef.current);
	}, []);
	const retry = useCallback(() => {
		setToken(null);
		setReady(false);
		setLoadError(false);
		setExpired(false);
		setAttempt((current) => current + 1);
	}, []);

	return {
		enabled: Boolean(siteKey),
		ready,
		loadError,
		expired,
		token,
		containerRef,
		attempt,
		reset,
		retry,
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
		<div className="turnstile-challenge">
			<div key={challenge.attempt} ref={challenge.containerRef} />
			{challenge.loadError ? (
				<div className="turnstile-challenge__status" role="status">
					<p className="turnstile-challenge__message">
						The security check didn’t load. Check your connection, then retry.
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={challenge.retry}
					>
						Retry security check
					</Button>
				</div>
			) : !challenge.ready ? (
				<p className="turnstile-challenge__message" role="status">
					Loading security check…
				</p>
			) : challenge.token ? (
				<p className="turnstile-challenge__message" role="status">
					Security check complete.
				</p>
			) : challenge.expired ? (
				<p className="turnstile-challenge__message" role="status">
					The security check expired. Complete it again to continue.
				</p>
			) : null}
		</div>
	);
}
