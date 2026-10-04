import { CircleAlert, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

/** Persistent feedback next to the action, with focus only for explicit failures. */
export function ActionNotice({
	title,
	message,
	children,
	onDismiss,
	focus = false,
}: {
	title: string;
	message: string;
	children?: ReactNode;
	onDismiss?: () => void;
	focus?: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new failure should regain focus even while an earlier notice is mounted.
	useEffect(() => {
		if (focus) ref.current?.focus();
	}, [focus, message]);
	return (
		<div className="action-notice" ref={ref} tabIndex={-1} role="alert">
			<CircleAlert aria-hidden="true" />
			<div className="action-notice__content">
				<strong>{title}</strong>
				<p>{message}</p>
				{children}
			</div>
			{onDismiss ? (
				<button
					className="studio-icon-button"
					type="button"
					aria-label="Dismiss message"
					onClick={onDismiss}
				>
					<X aria-hidden="true" />
				</button>
			) : null}
		</div>
	);
}
