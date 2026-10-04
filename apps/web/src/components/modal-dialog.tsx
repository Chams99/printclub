import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A native modal <dialog>. `showModal()` traps focus inside, makes the rest of
 * the page inert to keyboard and screen readers, and renders in the top layer.
 * Render it conditionally: mounting opens it, unmounting closes it and returns
 * focus to the element that opened it. Escape calls `onClose`, so React state
 * stays the single source of truth.
 */
export default function ModalDialog({
	className,
	labelledBy,
	onClose,
	children,
	returnFocusRef,
	fallbackFocusRef,
}: {
	className: string;
	labelledBy: string;
	onClose: () => void;
	children: ReactNode;
	returnFocusRef?: { current: HTMLElement | null };
	fallbackFocusRef?: { current: HTMLElement | null };
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setPortalRoot(document.body);
	}, []);

	useEffect(() => {
		if (!portalRoot) return;
		const dialog = ref.current;
		if (!dialog) return;
		const previousFocus = document.activeElement as HTMLElement | null;
		dialog.showModal();
		// Start on the first field or action rather than the close button.
		dialog
			.querySelector<HTMLElement>("input, button:not([data-dialog-close])")
			?.focus();
		return () => {
			if (dialog.open) dialog.close();
			requestAnimationFrame(() => {
				const targets = [
					returnFocusRef?.current,
					fallbackFocusRef?.current,
					previousFocus,
				];
				const target = targets.find((candidate) => {
					if (!candidate?.isConnected || candidate.matches(":disabled")) {
						return false;
					}
					const style = window.getComputedStyle(candidate);
					return (
						style.display !== "none" &&
						style.visibility !== "hidden" &&
						candidate.getClientRects().length > 0
					);
				});
				target?.focus();
			});
		};
	}, [fallbackFocusRef, portalRoot, returnFocusRef]);

	if (!portalRoot) return null;

	return createPortal(
		<dialog
			ref={ref}
			className={className}
			aria-labelledby={labelledBy}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
		>
			{children}
		</dialog>,
		portalRoot,
	);
}
