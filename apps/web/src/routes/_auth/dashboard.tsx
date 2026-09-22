import { getProduct } from "@PhotoPrinting/api/domain/print";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	ArrowUpRight,
	Clock3,
	FilePlus2,
	FolderOpen,
	Settings2,
	Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
	type CreationDraft,
	findResumableCreationDraft,
	productImages,
	templateDefinitions,
} from "@/lib/creation-draft";

export const Route = createFileRoute("/_auth/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	const { session } = Route.useRouteContext();
	const name = session.data?.user.name ?? "there";
	const firstName = name.split(" ")[0] || "there";
	const [draft, setDraft] = useState<CreationDraft | null>(null);

	useEffect(() => {
		void findResumableCreationDraft().then(setDraft);
	}, []);

	const product = draft ? getProduct(draft.productId) : null;
	const template = draft
		? templateDefinitions.find((item) => item.id === draft.templateId)
		: null;
	const draftHref = draft
		? `/studio?draft=${encodeURIComponent(draft.id)}`
		: "/create";
	return (
		<main className="account-page dashboard-page" id="main-content">
			<div className="account-shell dashboard-shell">
				<nav className="dashboard-subnav" aria-label="Workspace navigation">
					<span className="dashboard-subnav__current">Workspace</span>
					<Link to="/orders">Requests</Link>
					<Link to="/account">Account</Link>
				</nav>

				<header className="dashboard-intro">
					<div>
						<p className="eyebrow eyebrow--blue">Your workspace</p>
						<h1>Good to see you, {firstName}.</h1>
						<p className="account-lede">
							Make a print, pick up a design, or check the requests you have
							sent to the studio.
						</p>
					</div>
					<Link className="button-v2 button-v2--primary" to="/create">
						<FilePlus2 aria-hidden="true" />
						New print
					</Link>
				</header>

				<section
					className="dashboard-hero"
					aria-labelledby="dashboard-hero-title"
				>
					<div className="dashboard-hero__copy">
						<span className="dashboard-hero__status">
							{draft ? (
								<Clock3 aria-hidden="true" />
							) : (
								<Sparkles aria-hidden="true" />
							)}
							{draft ? "Draft in this browser" : "Ready when you are"}
						</span>
						<h2 id="dashboard-hero-title">
							{draft
								? "Pick up where you left off."
								: "Your next print starts here."}
						</h2>
						<p>
							{draft
								? `${draft.projectName} · ${product?.name ?? "Print"} · ${draft.assets.length} photo${draft.assets.length === 1 ? "" : "s"}`
								: "Choose a format, add a photo, and shape something worth keeping in the studio."}
						</p>
						<a className="button-v2 button-v2--light" href={draftHref}>
							{draft ? "Continue design" : "Start a new print"}
							<ArrowRight aria-hidden="true" />
						</a>
					</div>
					<div className="dashboard-hero__visual" aria-hidden="true">
						<div className="dashboard-print dashboard-print--back" />
						<div className="dashboard-print dashboard-print--middle" />
						<div className="dashboard-print dashboard-print--front">
							<img
								src={
									draft
										? productImages[draft.productId]
										: "/images/printclub-hero.webp"
								}
								alt=""
								width="480"
								height="600"
							/>
							<span>{template?.label ?? "A print worth keeping"}</span>
						</div>
					</div>
				</section>

				<div className="dashboard-panels">
					<section
						className="dashboard-panel"
						aria-labelledby="recent-work-title"
					>
						<div className="dashboard-panel__heading">
							<div>
								<p className="eyebrow">Recent work</p>
								<h2 id="recent-work-title">Your browser designs</h2>
							</div>
							<FolderOpen aria-hidden="true" />
						</div>
						{draft ? (
							<a className="dashboard-draft" href={draftHref}>
								<span className="dashboard-draft__thumb">
									<img
										src={productImages[draft.productId]}
										alt=""
										width="80"
										height="96"
									/>
								</span>
								<span className="dashboard-draft__details">
									<strong>{draft.projectName}</strong>
									<small>
										{product?.name ?? "Print"} · Edited in this browser
									</small>
								</span>
								<ArrowUpRight aria-hidden="true" />
							</a>
						) : (
							<div className="dashboard-panel__empty">
								<p>No designs here yet.</p>
								<Link className="text-link-v2" to="/templates">
									Browse templates <ArrowRight aria-hidden="true" />
								</Link>
							</div>
						)}
					</section>

					<section
						className="dashboard-panel dashboard-panel--guide"
						aria-labelledby="guide-title"
					>
						<div className="dashboard-panel__heading">
							<div>
								<p className="eyebrow">The simple route</p>
								<h2 id="guide-title">From photo to print</h2>
							</div>
							<Settings2 aria-hidden="true" />
						</div>
						<ol className="dashboard-steps">
							<li>
								<span>01</span>
								<p>
									<strong>Choose a format</strong>
									<small>Classic, square, strip, poster, or framed.</small>
								</p>
							</li>
							<li>
								<span>02</span>
								<p>
									<strong>Shape the design</strong>
									<small>Crop, type, and arrange it in the studio.</small>
								</p>
							</li>
							<li>
								<span>03</span>
								<p>
									<strong>Request a proof</strong>
									<small>Send a demo request when it feels right.</small>
								</p>
							</li>
						</ol>
					</section>
				</div>
			</div>
		</main>
	);
}
