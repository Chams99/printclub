import { getProduct } from "@PhotoPrinting/api/domain/print";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";

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
	if (!product) {
		return (
			<main className="product-page" id="main-content">
				<section className="product-hero-v2">
					<div className="product-hero-v2__copy">
						<p className="eyebrow eyebrow--blue">Format not found</p>
						<h1>Let’s find the right shape.</h1>
						<p>
							That format is not in the current demo catalog. Browse the
							available print formats and choose a new starting point.
						</p>
							<a className="button-v2 button-v2--primary" href="/formats">
							Explore formats <ArrowUpRight aria-hidden="true" />
						</a>
					</div>
				</section>
			</main>
		);
	}

	return (
		<main className="product-page" id="main-content">
			<section className="product-hero-v2">
				<div className="product-hero-v2__copy">
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
						<a
							className="button-v2 button-v2--primary"
							href={`/create?product=${product.id}`}
						>
							Start this format <ArrowUpRight aria-hidden="true" />
						</a>
						<a className="button-v2 button-v2--ghost" href="/formats">
							See all formats
						</a>
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
						src={productImages[product.kind] ?? productImages["classic-print"]}
						alt={`${product.name} preview with an original printclub photograph`}
						width="1536"
						height="1024"
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
