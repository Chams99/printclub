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
import { ActionNotice } from "@/components/action-notice";
import WorkspaceNav from "@/components/workspace-nav";
import { actionErrorMessage } from "@/lib/action-error";
import {
	type CreationDraft,
	findResumableCreationDraft,
	productImages,
	templateDefinitions,
} from "@/lib/creation-draft";
import { responsiveImage } from "@/lib/images";

export const Route = createFileRoute("/_auth/dashboard")({
	head: () => ({ meta: [{ title: "Your workspace · printclub" }] }),
	component: DashboardPage,
});

function DashboardPage() {
	const { session } = Route.useRouteContext();
	const name = session.data?.user.name ?? "there";
	const firstName = name.split(" ")[0] || "there";
	const [draft, setDraft] = useState<CreationDraft | null>(null);
	const [draftError, setDraftError] = useState<string>();
	const [loading, setLoading] = useState(true);
	const [attempt, setAttempt] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly reruns the storage read after Retry.
	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setDraftError(undefined);
		void findResumableCreationDraft()
			.then((next) => {
				if (!cancelled) setDraft(next);
			})
			.catch((error: unknown) => {
				if (!cancelled) setDraftError(actionErrorMessage(error, "load"));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [attempt]);

	const product = draft ? getProduct(draft.productId) : null;
	// productImages is keyed by product kind, not product id.
	const draftImage =
		productImages[product?.kind ?? "classic-print"] ??
		"/images/printclub-hero.webp";
	const template = draft
		? templateDefinitions.find((item) => item.id === draft.templateId)
		: null;
	return (
		<main
			className="account-page workspace-page dashboard-page"
			id="main-content"
		>
			<div className="account-shell dashboard-shell enter-stagger">
				<WorkspaceNav />
				{draftError ? (
					<ActionNotice
						title="Browser designs could not be loaded"
						message={draftError}
					>
						<button
							className="button-v2 button-v2--ghost"
							type="button"
							onClick={() => setAttempt((value) => value + 1)}
						>
							Retry
						</button>
					</ActionNotice>
				) : null}

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
						{loading ? (
							<p role="status">Loading your browser designs…</p>
						) : draftError ? (
							<p>
								Your saved designs are unavailable until the storage check
								succeeds.
							</p>
						) : draft ? (
							<Link
								className="button-v2 button-v2--light"
								to="/studio"
								search={{ draft: draft.id }}
							>
								Continue design <ArrowRight aria-hidden="true" />
							</Link>
						) : (
							<Link className="button-v2 button-v2--light" to="/create">
								Start a new print <ArrowRight aria-hidden="true" />
							</Link>
						)}
					</div>
					<div className="dashboard-hero__visual" aria-hidden="true">
						<div className="dashboard-print dashboard-print--back" />
						<div className="dashboard-print dashboard-print--middle" />
						<div className="dashboard-print dashboard-print--front">
							<img
								{...responsiveImage(
									draftImage,
									"(max-width: 760px) 136px, 192px",
								)}
								alt=""
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
						{loading ? (
							<p role="status">Loading your browser designs…</p>
						) : draftError ? (
							<p>
								Your saved designs are unavailable until the storage check
								succeeds.
							</p>
						) : draft ? (
							<Link
								className="dashboard-draft"
								to="/studio"
								search={{ draft: draft.id }}
							>
								<span className="dashboard-draft__thumb">
									<img {...responsiveImage(draftImage, "58px")} alt="" />
								</span>
								<span className="dashboard-draft__details">
									<strong>{draft.projectName}</strong>
									<small>
										{product?.name ?? "Print"} · Edited in this browser
									</small>
								</span>
								<ArrowUpRight aria-hidden="true" />
							</Link>
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
