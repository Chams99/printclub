import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";

export default function Header() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isAppShell = pathname === "/studio" || pathname === "/login";

	return (
		<>
			<a className="skip-link" href="#main-content">
				{isAppShell ? "Skip to main content" : "Skip to content"}
			</a>
			{isAppShell ? null : (
				<header className="site-header site-header--v2">
					<div className="site-header__v2-inner">
						<Link className="brand brand--v2" to="/" reloadDocument>
							<span className="brand__mark">
								<img src="/printclub-mark.svg" alt="" aria-hidden="true" />
							</span>
							<span translate="no">printclub</span>
						</Link>
						<nav className="site-nav site-nav--v2" aria-label="Main navigation">
							<Link to="/formats">Formats</Link>
							<Link to="/templates">Templates</Link>
							<Link to="/how-it-works">How it works</Link>
						</nav>
						<div className="site-header__actions site-header__actions--v2">
							<Link className="site-header__login" to="/login" search={{}}>
								Sign in
							</Link>
							<Link
								className="site-header__shop site-header__shop--v2"
								to="/create"
							>
								Create a print
							</Link>
						</div>
						<details className="site-header__mobile">
							<summary aria-label="Open navigation">
								<Menu aria-hidden="true" />
								<span className="sr-only">Open navigation</span>
							</summary>
							<div className="site-header__mobile-panel">
								<div>
									<strong>Menu</strong>
									<X aria-hidden="true" />
								</div>
								<Link to="/formats">Formats</Link>
								<Link to="/templates">Templates</Link>
								<Link to="/how-it-works">How it works</Link>
								<Link to="/create">Create a print</Link>
								<Link to="/login" search={{}}>
									Sign in
								</Link>
							</div>
						</details>
					</div>
				</header>
			)}
		</>
	);
}
