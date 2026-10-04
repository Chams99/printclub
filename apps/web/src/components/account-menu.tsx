import { Button } from "@PhotoPrinting/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@PhotoPrinting/ui/components/dropdown-menu";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, CircleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import ModalDialog from "./modal-dialog";

/**
 * The signed-in account dropdown. Loaded lazily by UserMenu: the menu primitive
 * and its positioning engine are ~100 KB that signed-out visitors never need.
 */
export default function AccountMenu({
	name,
	email,
	mobileMenuSummaryRef,
}: {
	name: string;
	email: string;
	mobileMenuSummaryRef: { current: HTMLElement | null };
}) {
	const navigate = useNavigate();
	const accountTriggerRef = useRef<HTMLButtonElement>(null);
	const signOutBusyRef = useRef(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [signOutError, setSignOutError] = useState<string | null>(null);

	async function signOut() {
		if (signOutBusyRef.current) return;
		signOutBusyRef.current = true;
		setIsSigningOut(true);
		setSignOutError(null);
		let signedOut = false;
		try {
			const result = await authClient.signOut();
			if (result.error) {
				setSignOutError(
					"We couldn’t sign you out. Check your connection and retry.",
				);
				return;
			}
			signedOut = true;
			setSignOutError(null);
		} catch {
			setSignOutError(
				"We couldn’t sign you out. Check your connection and retry.",
			);
		} finally {
			signOutBusyRef.current = false;
			setIsSigningOut(false);
		}
		if (signedOut) {
			try {
				await navigate({ to: "/" });
			} catch {
				window.location.assign("/");
			}
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							ref={accountTriggerRef}
							variant="outline"
							className="user-menu__trigger"
						/>
					}
				>
					<span className="user-menu__name">{name}</span>
					<ChevronDown aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent className="user-menu__content" align="end">
					<DropdownMenuGroup>
						<DropdownMenuLabel className="user-menu__label">
							My account
						</DropdownMenuLabel>
						<DropdownMenuLabel className="user-menu__email">
							{email}
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="user-menu__item"
							render={<Link to="/account" />}
						>
							Account settings
						</DropdownMenuItem>
						<DropdownMenuItem
							className="user-menu__item"
							variant="destructive"
							disabled={isSigningOut}
							onClick={() => void signOut()}
						>
							{isSigningOut ? "Signing out…" : "Sign out"}
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			{signOutError ? (
				<ModalDialog
					className="studio-dialog"
					labelledBy="account-sign-out-title"
					onClose={() => setSignOutError(null)}
					returnFocusRef={accountTriggerRef}
					fallbackFocusRef={mobileMenuSummaryRef}
				>
					<span className="studio-app__eyebrow">Account</span>
					<h2 id="account-sign-out-title">Sign out failed</h2>
					<p className="studio-dialog__error" role="alert">
						<CircleAlert aria-hidden="true" />
						<span>{signOutError}</span>
					</p>
					<div className="studio-dialog__actions">
						<Button
							className="studio-action-button studio-action-button--primary"
							type="button"
							onClick={() => void signOut()}
						>
							Retry sign out
						</Button>
						<Button
							className="studio-action-button"
							type="button"
							variant="outline"
							onClick={() => setSignOutError(null)}
						>
							Cancel
						</Button>
					</div>
				</ModalDialog>
			) : null}
		</>
	);
}
