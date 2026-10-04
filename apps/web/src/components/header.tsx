import { Button } from "@PhotoPrinting/ui/components/button";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CircleAlert, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useAuthSession } from "@/lib/use-auth-session";

import ModalDialog from "./modal-dialog";
import UserMenu from "./user-menu";

const navLinks = [
	{ to: "/formats", label: "Formats" },
	{ to: "/templates", label: "Templates" },
	{ to: "/how-it-works", label: "How it works" },
] as const;

export default function Header() {
	const navigate = useNavigate();
	const {
		session,
		state: sessionState,
		refetch: refetchSession,
	} = useAuthSession();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isAppShell = pathname === "/studio" || pathname === "/login";
	const mobileMenuRef = useRef<HTMLDetailsElement>(null);
	const mobileMenuSummaryRef = useRef<HTMLElement | null>(null);
	const signOutBusyRef = useRef(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [signOutError, setSignOutError] = useState<string | null>(null);

	const closeMobileMenu = () => {
		if (mobileMenuRef.current) mobileMenuRef.current.open = false;
	};
	const signOut = async () => {
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
			closeMobileMenu();
			try {
				await navigate({ to: "/" });
			} catch {
				window.location.assign("/");
			}
		}
	};

	// <details> has no notion of client-side navigation, Escape, or outside clicks.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const menu = mobileMenuRef.current;
			if (event.key !== "Escape" || !menu?.open) return;
			menu.open = false;
			menu.querySelector("summary")?.focus();
		};
		const onPointerDown = (event: PointerEvent) => {
			const menu = mobileMenuRef.current;
			if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
		};
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, []);

	return (
		<>
			<a className="skip-link" href="#main-content">
				{isAppShell ? "Skip to main content" : "Skip to content"}
			</a>
			{isAppShell ? null : (
				<>
					<header className="site-header site-header--v2">
						<div className="site-header__v2-inner">
							<Link className="brand brand--v2" to="/">
								<span className="brand__mark">
									<img src="/printclub-mark.svg" alt="" aria-hidden="true" />
								</span>
								<span translate="no">printclub</span>
							</Link>
							<nav
								className="site-nav site-nav--v2"
								aria-label="Main navigation"
							>
								{navLinks.map((link) => (
									<Link key={link.to} to={link.to}>
										{link.label}
									</Link>
								))}
							</nav>
							<div className="site-header__actions site-header__actions--v2">
								<UserMenu mobileMenuSummaryRef={mobileMenuSummaryRef} />
								<Link
									className="site-header__shop site-header__shop--v2"
									to="/create"
								>
									Create a print
								</Link>
							</div>
							<details className="site-header__mobile" ref={mobileMenuRef}>
								<summary
									ref={mobileMenuSummaryRef}
									aria-label="Navigation menu"
								>
									<Menu aria-hidden="true" />
									<X aria-hidden="true" />
								</summary>
								<nav
									className="site-header__mobile-panel"
									aria-label="Mobile navigation"
								>
									{navLinks.map((link) => (
										<Link key={link.to} to={link.to} onClick={closeMobileMenu}>
											{link.label}
										</Link>
									))}
									{sessionState === "authenticated" && session ? (
										<>
											<p className="site-header__mobile-account">
												Signed in as <strong>{session.user.name}</strong>
											</p>
											<Link to="/dashboard" onClick={closeMobileMenu}>
												My workspace
											</Link>
											<Link to="/account" onClick={closeMobileMenu}>
												Account settings
											</Link>
											<Button
												className="site-header__mobile-action"
												variant="ghost"
												type="button"
												disabled={isSigningOut}
												onClick={() => void signOut()}
											>
												{isSigningOut ? "Signing out…" : "Sign out"}
											</Button>
										</>
									) : sessionState === "anonymous" ? (
										<Link to="/login" search={{}} onClick={closeMobileMenu}>
											Sign in
										</Link>
									) : sessionState === "error" ? (
										<Button
											className="site-header__mobile-action"
											variant="ghost"
											type="button"
											onClick={() => void refetchSession()}
										>
											Couldn’t check account · Retry
										</Button>
									) : (
										<p className="site-header__mobile-account" role="status">
											Checking account…
										</p>
									)}
									<hr />
									<Link
										className="site-header__mobile-cta"
										to="/create"
										onClick={closeMobileMenu}
									>
										Create a print
									</Link>
								</nav>
							</details>
						</div>
					</header>
					{signOutError ? (
						<ModalDialog
							className="studio-dialog"
							labelledBy="mobile-sign-out-title"
							onClose={() => setSignOutError(null)}
							returnFocusRef={mobileMenuSummaryRef}
						>
							<span className="studio-app__eyebrow">Account</span>
							<h2 id="mobile-sign-out-title">Sign out failed</h2>
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
			)}
		</>
	);
}
