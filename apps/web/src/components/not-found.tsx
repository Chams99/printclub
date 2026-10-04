import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

export default function NotFound() {
	return (
		<main id="main-content" className="not-found-page">
			<div className="not-found-page__inner enter-stagger">
				<p className="eyebrow eyebrow--blue">404 · Page not found</p>
				<h1>
					This page <em>didn’t make the print.</em>
				</h1>
				<p>
					The link may be out of date, or the page may have moved. Head back to
					the homepage or start a new print.
				</p>
				<div className="not-found-page__actions">
					<Link className="button-v2 button-v2--primary" to="/">
						Back to the homepage
					</Link>
					<Link className="button-v2 button-v2--ghost" to="/create">
						Create a print <ArrowUpRight aria-hidden="true" />
					</Link>
				</div>
			</div>
		</main>
	);
}
