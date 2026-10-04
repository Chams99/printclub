import { catalog } from "@PhotoPrinting/api/domain/print";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Camera, Check, ChevronRight } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { responsiveImage } from "@/lib/images";

type TemplateGroupId = (typeof templateGroups)[number]["id"];
type HomeSearch = {
	format?: string;
	collection?: Exclude<TemplateGroupId, "all">;
};

export const Route = createFileRoute("/")({
	// The selected format and template collection live in the URL, so a link
	// like /?format=poster-a3 opens with that choice and survives a reload.
	validateSearch: (search: Record<string, unknown>): HomeSearch => ({
		format: catalog.some((product) => product.id === search.format)
			? (search.format as string)
			: undefined,
		collection: templateGroups.some(
			(group) => group.id !== "all" && group.id === search.collection,
		)
			? (search.collection as HomeSearch["collection"])
			: undefined,
	}),
	component: HomePage,
});

const easeOut = [0.22, 1, 0.36, 1] as const;

const templateGroups = [
	{
		id: "all",
		label: "All",
		image: "/images/printclub-hero.webp",
		title: "A considered starting point for your next print.",
		templateId: "caption",
	},
	{
		id: "travel",
		label: "Travel",
		image: "/images/template-travel.webp",
		title: "A little more world in every frame.",
		templateId: "gallery",
	},
	{
		id: "everyday",
		label: "Everyday",
		image: "/images/template-everyday.webp",
		title: "The ordinary deserves a place on the wall.",
		templateId: "gallery",
	},
	{
		id: "celebrations",
		label: "Celebrations",
		image: "/images/template-celebrations.webp",
		title: "Keep the night going a little longer.",
		templateId: "celebration",
	},
] as const;

const formatImages = [
	{
		image: "/images/printclub-hero.webp",
		alt: "Friends looking through printed photographs on a linen blanket",
	},
	{
		image: "/images/template-travel.webp",
		alt: "A swimmer in a clear mountain lake",
	},
	{
		image: "/images/template-everyday.webp",
		alt: "Coffee, an orange, and a notebook by a sunny window",
	},
	{
		image: "/images/template-celebrations.webp",
		alt: "Friends dancing beneath string lights at dusk",
	},
	{
		image: "/images/template-framed.webp",
		alt: "A botanical photograph presented in a quiet oak frame",
	},
] as const;

function FormatPreview({
	product,
	image,
	alt,
}: {
	product: (typeof catalog)[number];
	image: string;
	alt: string;
}) {
	return (
		<motion.div
			className={`format-preview format-preview--${product.kind}`}
			initial={{ opacity: 0, scale: 0.97, y: 10 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.98, y: -6 }}
			transition={{ duration: 0.45, ease: easeOut }}
		>
			<div className="format-preview__print">
				<img
					{...responsiveImage(image, "(max-width: 760px) 60vw, 400px")}
					alt={alt}
					loading="lazy"
				/>
				{product.kind === "photo-strip" ? (
					<span className="format-preview__strip-lines" aria-hidden="true" />
				) : null}
			</div>
			<div className="format-preview__label">
				<strong>{product.name}</strong>
				<span>
					{product.widthMm} × {product.heightMm} mm
				</span>
			</div>
		</motion.div>
	);
}

function HomePage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/" });
	const selectedFormat = Math.max(
		0,
		catalog.findIndex((product) => product.id === search.format),
	);
	const templateFilter: TemplateGroupId = search.collection ?? "all";
	function updateSearch(next: HomeSearch) {
		// Replace (not push) so tab clicks do not flood history, and keep the scroll position.
		void navigate({
			search: (previous) => ({ ...previous, ...next }),
			replace: true,
			resetScroll: false,
		});
	}
	const selectedTemplate =
		templateGroups.find((group) => group.id === templateFilter) ??
		templateGroups[0];
	const selectedProduct = catalog[selectedFormat] ?? catalog[0];

	return (
		<MotionConfig reducedMotion="user">
			<main id="main-content" className="marketing-page">
				<section className="hero-v2">
					<div className="hero-v2__copy enter-stagger">
						<p className="eyebrow eyebrow--blue">
							Photo prints, without the guesswork
						</p>
						<h1>
							Print the moments
							<br />
							<em>you keep reopening.</em>
						</h1>
						<p className="hero-v2__lede">
							Choose a format, adjust the crop, and download a preview before
							you request a demo print.
						</p>
						<div className="hero-v2__actions">
							<Link className="button-v2 button-v2--primary" to="/create">
								<Camera aria-hidden="true" /> Create a print
							</Link>
							<Link className="button-v2 button-v2--ghost" to="/formats">
								Explore formats <ArrowUpRight aria-hidden="true" />
							</Link>
						</div>
						<div className="hero-v2__trust">
							<span>
								<Check aria-hidden="true" /> Guest editing
							</span>
							<span>
								<Check aria-hidden="true" /> No payment in this demo
							</span>
						</div>
					</div>
					<div className="hero-v2__media">
						<img
							{...responsiveImage(
								"/images/printclub-hero.webp",
								"(max-width: 760px) calc(100vw - 2rem), 60vw",
							)}
							alt="Friends looking through printed photographs beside a compact camera"
							loading="eager"
							fetchPriority="high"
						/>
						<div className="hero-v2__caption">
							<span>one photo, off-screen</span>
							<span>01 / 05</span>
						</div>
					</div>
				</section>

				<section className="format-section" id="formats">
					<div className="section-intro-v2">
						<p className="eyebrow">Formats</p>
						<h2>
							Choose the shape
							<br />
							<em>that fits the photo.</em>
						</h2>
						<p>
							Five formats, one print-aware editor. Start with dimensions, then
							refine the composition.
						</p>
					</div>
					<div className="format-gallery-v2">
						<div className="format-gallery-v2__image" aria-live="polite">
							<AnimatePresence initial={false}>
								<FormatPreview
									key={selectedProduct.id}
									product={selectedProduct}
									image={formatImages[selectedFormat].image}
									alt={formatImages[selectedFormat].alt}
								/>
							</AnimatePresence>
						</div>
						<div
							className="format-gallery-v2__list"
							role="tablist"
							aria-label="Print formats"
						>
							{catalog.map((product, index) => (
								<button
									type="button"
									role="tab"
									aria-selected={selectedFormat === index}
									className={selectedFormat === index ? "is-active" : ""}
									onClick={() =>
										updateSearch({
											format: index === 0 ? undefined : product.id,
										})
									}
									key={product.id}
								>
									<span>0{index + 1}</span>
									<strong>{product.name}</strong>
									<small>
										{product.widthMm} × {product.heightMm} mm
									</small>
									<ChevronRight aria-hidden="true" />
								</button>
							))}
						</div>
					</div>
					<div className="format-gallery-v2__details">
						<div key={selectedProduct.id} className="swap-in">
							<span className="eyebrow eyebrow--blue">
								{selectedProduct.name}
							</span>
							<p>{selectedProduct.description}</p>
						</div>
						<Link
							className="text-link-v2"
							to="/formats/$productId"
							params={{ productId: selectedProduct.id }}
						>
							See dimensions and options <ArrowUpRight aria-hidden="true" />
						</Link>
					</div>
				</section>

				<PrintStory />

				<section className="template-section" id="templates">
					<div className="section-intro-v2 section-intro-v2--row">
						<div>
							<p className="eyebrow">Templates</p>
							<h2>
								Start with a layout
								<br />
								<em>that gets out of the way.</em>
							</h2>
						</div>
						<p>
							Use a template for a head start. Every layer stays editable in the
							studio.
						</p>
					</div>
					<div
						className="template-filters"
						role="tablist"
						aria-label="Template categories"
					>
						{templateGroups.map((group) => (
							<button
								type="button"
								role="tab"
								aria-selected={templateFilter === group.id}
								className={templateFilter === group.id ? "is-active" : ""}
								onClick={() =>
									updateSearch({
										collection: group.id === "all" ? undefined : group.id,
									})
								}
								key={group.id}
							>
								{group.label}
							</button>
						))}
					</div>
					<div className="template-feature reveal-on-scroll">
						<div className="template-feature__media">
							<AnimatePresence initial={false}>
								<motion.img
									key={templateFilter}
									alt=""
									initial={{ opacity: 0, scale: 1.04 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.6, ease: easeOut }}
									{...responsiveImage(
										selectedTemplate.image,
										"(max-width: 760px) 100vw, 60vw",
									)}
									loading="lazy"
								/>
							</AnimatePresence>
						</div>
						<div>
							<p
								key={`${templateFilter}-label`}
								className="eyebrow eyebrow--blue swap-in"
							>
								{selectedTemplate.label} collection
							</p>
							<h3 key={templateFilter} className="swap-in">
								{selectedTemplate.title}
							</h3>
							<Link
								className="text-link-v2"
								to="/create"
								search={{ template: selectedTemplate.templateId }}
							>
								Use this feeling <ArrowUpRight aria-hidden="true" />
							</Link>
							<Link className="text-link-v2" to="/templates">
								Browse all templates <ArrowUpRight aria-hidden="true" />
							</Link>
						</div>
					</div>
				</section>

				<section className="quality-section">
					<div className="quality-section__visual">
						<div className="quality-photo reveal-on-scroll">
							<img
								{...responsiveImage(
									"/images/template-travel.webp",
									"(max-width: 760px) calc(100vw - 2rem), 448px",
								)}
								alt="A swimmer in a clear mountain lake"
								loading="lazy"
							/>
							<span className="quality-crop" aria-hidden="true" />
						</div>
					</div>
					<div className="quality-section__copy">
						<p className="eyebrow eyebrow--blue">Print checks</p>
						<h2>
							Know what will fit
							<br />
							<em>before it is printed.</em>
						</h2>
						<p>
							The editor shows the crop, safe area, and effective resolution
							while you work.
						</p>
						<div className="quality-meter">
							<div>
								<span>Effective resolution</span>
								<strong>312 dpi</strong>
							</div>
							<div className="quality-meter__bar">
								<span />
							</div>
							<small>Looks good for a 10 × 15 cm print</small>
						</div>
						<Link className="button-v2 button-v2--dark" to="/create">
							Open the studio <ArrowUpRight aria-hidden="true" />
						</Link>
					</div>
				</section>

				<section className="home-wayfinding-v2">
					<div>
						<p className="eyebrow eyebrow--blue">A calmer way to create</p>
						<h2>
							Three decisions.
							<br />
							<em>One print.</em>
						</h2>
					</div>
					<div>
						<p>
							Choose a format, make the composition, and see what the finished
							print will feel like before you request it.
						</p>
						<Link className="text-link-v2" to="/how-it-works">
							See how it works <ArrowUpRight aria-hidden="true" />
						</Link>
					</div>
				</section>

				<section className="faq-section-v2" id="faq">
					<div className="section-intro-v2 section-intro-v2--row">
						<div>
							<p className="eyebrow">Good to know</p>
							<h2>
								Print with
								<br />
								<em>fewer surprises.</em>
							</h2>
						</div>
						<p>
							Everything here is designed to be explored before you commit. This
							portfolio demo is transparent about what is ready today.
						</p>
					</div>
					<div className="faq-list-v2">
						<details>
							<summary>Can I try the studio without an account?</summary>
							<p>
								Yes. Designs save automatically in this browser as you work, and
								your photos are never uploaded. Cloud projects and sharing
								aren’t available yet.
							</p>
						</details>
						<details>
							<summary>Does a demo request charge me?</summary>
							<p>
								No. A request is a local or clearly labelled demo submission.
								Pricing, payment, and fulfillment wait for a print partner.
							</p>
						</details>
						<details>
							<summary>What files can I add?</summary>
							<p>
								The guest studio accepts JPEG, PNG, and WebP images up to 8 MB,
								with a quality signal as you compose.
							</p>
						</details>
					</div>
				</section>

				<section className="final-cta-v2">
					<p className="eyebrow">Start with one photo</p>
					<h2>
						Give the frame
						<br />
						<em>a place to stay.</em>
					</h2>
					<Link className="button-v2 button-v2--light" to="/create">
						Create a print <ArrowUpRight aria-hidden="true" />
					</Link>
				</section>
				<footer className="marketing-footer-v2">
					<div>
						<Link className="site-brand site-brand--footer" to="/">
							<img
								src="/printclub-mark.svg"
								alt=""
								aria-hidden="true"
								width="28"
								height="28"
							/>
							<span translate="no">printclub</span>
						</Link>
						<p>Print-aware editing for the photos you keep.</p>
					</div>
					<nav aria-label="Footer">
						<Link to="/formats">Formats</Link>
						<Link to="/templates">Templates</Link>
						<Link to="/how-it-works">How it works</Link>
						<a href="#faq">FAQ</a>
						<Link to="/login" search={{}}>
							Sign in
						</Link>
					</nav>
					<small>Portfolio demo · No payment or fulfillment connected</small>
				</footer>
			</main>
		</MotionConfig>
	);
}

const printScenes = [
	{
		id: "photo",
		number: "01",
		eyebrow: "The photo",
		title: "Add a photo.",
		copy: "Start with one image from your camera roll. You can add more in the studio.",
		image: "/images/printclub-hero.webp",
		alt: "Friends looking through printed photographs beside a compact camera",
		className: "print-scene--photo",
	},
	{
		id: "compose",
		number: "02",
		eyebrow: "The composition",
		title: "Set the crop.",
		copy: "Adjust the frame, add a note, and keep the safe area in view.",
		image: "/images/template-everyday.webp",
		alt: "A coffee, orange, and notebook arranged as an everyday print composition",
		className: "print-scene--compose",
	},
	{
		id: "finished",
		number: "03",
		eyebrow: "The finished print",
		title: "Review the proof.",
		copy: "Download a preview or send a clearly labelled demo request when it is ready.",
		image: "/images/template-framed.webp",
		alt: "A botanical photograph presented as a framed print",
		className: "print-scene--finished",
	},
] as const;

function PrintStory() {
	return (
		<section
			className="print-story-section"
			aria-labelledby="print-story-title"
		>
			<div className="print-story-section__intro">
				<div>
					<p className="eyebrow eyebrow--blue">The workflow</p>
					<h2 id="print-story-title">
						See the idea
						<br />
						<em>before you print.</em>
					</h2>
				</div>
				<p>
					A short path from image to proof: pick a photo, compose it, and
					inspect the result.
				</p>
			</div>
			<div className="print-story-grid">
				{printScenes.map((scene) => (
					<article
						key={scene.id}
						className={`print-scene ${scene.className} reveal-on-scroll`}
					>
						<div className="print-scene__media">
							<img
								{...responsiveImage(
									scene.image,
									"(max-width: 760px) calc(100vw - 2rem), (max-width: 900px) 50vw, 420px",
								)}
								alt={scene.alt}
								loading="lazy"
							/>
							{scene.id === "compose" ? (
								<span className="print-scene__safe" aria-hidden="true" />
							) : null}
						</div>
						<div className="print-scene__copy">
							<span>{scene.number}</span>
							<p className="eyebrow eyebrow--blue">{scene.eyebrow}</p>
							<h3>{scene.title}</h3>
							<p>{scene.copy}</p>
						</div>
					</article>
				))}
			</div>
		</section>
	);
}
