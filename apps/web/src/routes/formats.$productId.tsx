import { getProduct } from "@PhotoPrinting/api/domain/print";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";

import { responsiveImage } from "@/lib/images";

export const Route = createFileRoute("/formats/$productId")({
	head: () => ({
		meta: [
			{ title: "Print formats · printclub" },
			{
				name: "description",
				content: "Explore printclub formats and start a print-aware design.",
			},
		],
	}),
	component: ProductPage,
});

const productImages: Record<string, string> = {
	"classic-print": "/images/printclub-hero.webp",
	"square-print": "/images/template-everyday.webp",
	"photo-strip": "/images/template-celebrations.webp",
	poster: "/images/template-travel.webp",
	"framed-print": "/images/template-framed.webp",
};

function ProductPage() {
	const { productId } = Route.useParams();
	const product = getProduct(productId);
	const heroImage =
		productImages[product?.kind ?? "classic-print"] ??
		productImages["classic-print"];
	if (!product) {
		return (
			<main className="product-page" id="main-content">
				<section className="product-hero-v2">
					<div className="product-hero-v2__copy enter-stagger">
						<p className="eyebrow eyebrow--blue">Format not found</p>
						<h1>Let’s find the right shape.</h1>
						<p>
							That format is not in the current demo catalog. Browse the
							available print formats and choose a new starting point.
						</p>
						<Link className="button-v2 button-v2--primary" to="/formats">
							Explore formats <ArrowUpRight aria-hidden="true" />
						</Link>
					</div>
				</section>
			</main>
		);
	}

	return (
		<main className="product-page" id="main-content">
			<section className="product-hero-v2">
				<div className="product-hero-v2__copy enter-stagger">
					<p className="eyebrow eyebrow--blue">
						{product.kind.replaceAll("-", " ")}
					</p>
					<h1>
						{product.name}
						<br />
						<em>made tactile.</em>
					</h1>
					<p>{product.description}</p>
					<div className="product-hero-v2__actions">
						<Link
							className="button-v2 button-v2--primary"
							to="/create"
							search={{ product: product.id }}
						>
							Start this format <ArrowUpRight aria-hidden="true" />
						</Link>
						<Link className="button-v2 button-v2--ghost" to="/formats">
							See all formats
						</Link>
					</div>
					<ul className="hero-v2__trust">
						<li>
							<Check aria-hidden="true" /> {product.widthMm} ×{" "}
							{product.heightMm} mm artboard
						</li>
						<li>
							<Check aria-hidden="true" /> {product.qualityDpi} dpi quality
							guidance
						</li>
					</ul>
				</div>
				<div className="product-hero-v2__media">
					<img
						alt={`${product.name} preview with an original printclub photograph`}
						{...responsiveImage(
							heroImage,
							"(max-width: 900px) calc(100vw - 2rem), 448px",
						)}
						fetchPriority="high"
					/>
				</div>
			</section>
			<section className="product-facts-v2" aria-label="Format details">
				<article>
					<span>Finished size</span>
					<strong>
						{product.widthMm} × {product.heightMm} mm
					</strong>
				</article>
				<article>
					<span>Concept finish</span>
					<strong>{product.finish}</strong>
				</article>
				<article>
					<span>Workflow</span>
					<strong>Demo request · no payment</strong>
				</article>
			</section>
			<p className="product-note-v2">
				Finishes and dimensions are conceptual demo options for this portfolio
				project. A production print partner would validate paper, color,
				pricing, and fulfillment before launch.
			</p>
		</main>
	);
}
