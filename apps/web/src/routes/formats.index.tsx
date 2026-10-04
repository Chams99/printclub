import { catalog } from "@PhotoPrinting/api/domain/print";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";

import { responsiveImage } from "@/lib/images";

export const Route = createFileRoute("/formats/")({
	head: () => ({
		meta: [
			{ title: "Formats · printclub" },
			{
				name: "description",
				content:
					"Choose a print format, compare dimensions, and start a printclub design.",
			},
		],
	}),
	component: FormatsPage,
});

const productImages: Record<string, string> = {
	"classic-print": "/images/printclub-hero.webp",
	"square-print": "/images/template-everyday.webp",
	"photo-strip": "/images/template-celebrations.webp",
	poster: "/images/template-travel.webp",
	"framed-print": "/images/template-framed.webp",
};

function FormatsPage() {
	return (
		<main className="formats-index-page" id="main-content">
			<section className="formats-index-v2 enter-stagger">
				<p className="eyebrow eyebrow--blue">Choose your shape</p>
				<h1>
					Five ways to keep
					<br />
					<em>the good ones.</em>
				</h1>
				<p className="formats-index-v2__intro">
					Every format opens the same print-aware studio. Pick the proportion that
					fits the moment, then make the design yours.
				</p>
				<div className="formats-index-grid-v2">
					{catalog.map((product) => (
						<article
							className="format-index-card-v2 reveal-on-scroll"
							key={product.id}
						>
							<div
								className={`format-index-card-v2__media format-index-card-v2__media--${product.kind}`}
							>
								<img
									{...responsiveImage(
										productImages[product.kind],
										"(max-width: 760px) calc(100vw - 2rem), (max-width: 900px) 50vw, 240px",
									)}
									alt={`${product.name} preview`}
									loading="lazy"
									decoding="async"
								/>
							</div>
							<div className="format-index-card-v2__body">
								<p className="eyebrow eyebrow--blue">
									{product.kind.replaceAll("-", " ")}
								</p>
								<h2>{product.name}</h2>
								<p>{product.description}</p>
								<ul>
									<li>
										<Check aria-hidden="true" /> {product.widthMm} × {product.heightMm} mm
									</li>
									<li>
										<Check aria-hidden="true" /> {product.finish}
									</li>
								</ul>
								<Link
									className="text-link-v2"
									to="/formats/$productId"
									params={{ productId: product.id }}
								>
									See format <ArrowUpRight aria-hidden="true" />
								</Link>
							</div>
						</article>
					))}
				</div>
				<div className="formats-index-v2__footer">
					<p>
						Not sure where to begin? The classic print is the calmest first step.
					</p>
					<Link
						className="button-v2 button-v2--primary"
						to="/create"
						search={{ product: "classic-10x15" }}
					>
						Start with classic <ArrowUpRight aria-hidden="true" />
					</Link>
				</div>
			</section>
		</main>
	);
}
