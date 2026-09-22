import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { templateDefinitions } from "@/lib/creation-draft";

export const Route = createFileRoute("/templates")({
	head: () => ({
		meta: [
			{ title: "Templates · printclub" },
			{
				name: "description",
				content:
					"Browse visual print templates and open one in the printclub studio.",
			},
		],
	}),
	component: TemplatesPage,
});

function TemplatesPage() {
	return (
		<main className="template-browser-page" id="main-content">
			<section className="template-browser-v2">
				<p className="eyebrow eyebrow--blue">Start with a feeling</p>
				<h1>
					A thoughtful beginning
					<br />
					<em>for your next print.</em>
				</h1>
				<p>
					Each template is a real, editable starting composition. Open it in the
					studio, add your photo, and make the final decisions yourself.
				</p>
				<div className="template-browser-grid-v2">
					{templateDefinitions.map((template) => (
						<article className="template-browser-card-v2" key={template.id}>
							<img
								src={template.image}
								alt={`${template.category} template preview`}
								width="1536"
								height="1024"
							/>
							<div className="template-browser-card-v2__body">
								<span className="eyebrow eyebrow--blue">
									{template.category}
								</span>
								<h2>{template.label}</h2>
								<p>{template.description}</p>
								<a
									className="text-link-v2"
									href={`/create?template=${template.id}`}
								>
									Use template <ArrowUpRight aria-hidden="true" />
								</a>
							</div>
						</article>
					))}
				</div>
				<a className="text-link-v2" href="/">
					Back to the homepage <ArrowUpRight aria-hidden="true" />
				</a>
			</section>
		</main>
	);
}
