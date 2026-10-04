import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Image, Layers3, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
	head: () => ({
		meta: [
			{ title: "How it works · printclub" },
			{
				name: "description",
				content:
					"See how printclub turns a photo into a considered print design.",
			},
		],
	}),
	component: HowItWorksPage,
});

const steps = [
	{
		number: "01",
		icon: Image,
		title: "Bring the moment",
		copy:
			"Choose a photo from your device or start with an editable template. Guests can explore before creating an account.",
	},
	{
		number: "02",
		icon: Layers3,
		title: "Make it yours",
		copy:
			"Crop, arrange, add a note, and see the safe area and effective resolution while you compose.",
	},
	{
		number: "03",
		icon: PackageCheck,
		title: "Keep the result",
		copy:
			"Save the project in this browser, download a preview, or send a clearly labelled demo request. No payment is taken.",
	},
] as const;

function HowItWorksPage() {
	return (
		<main className="how-it-works-page" id="main-content">
			<section className="how-it-works-hero-v2 enter-stagger">
				<p className="eyebrow eyebrow--blue">A calmer way to create</p>
				<h1>
					From camera roll
					<br />
					<em>to something you can hold.</em>
				</h1>
				<p>
					printclub keeps the decisions visible and the process small: choose a
					format, make a composition, and decide what happens next.
				</p>
				<Link className="button-v2 button-v2--primary" to="/create">
					Try the studio <ArrowUpRight aria-hidden="true" />
				</Link>
			</section>
			<section className="how-it-works-steps-v2" aria-label="Three steps">
				{steps.map(({ number, icon: Icon, title, copy }) => (
					<article key={number} className="reveal-on-scroll">
						<span>{number}</span>
						<Icon aria-hidden="true" />
						<h2>{title}</h2>
						<p>{copy}</p>
					</article>
				))}
			</section>
			<section className="how-it-works-note-v2">
				<p className="eyebrow eyebrow--blue">Designed for confidence</p>
				<h2>See the crop before it becomes a print.</h2>
				<p>
					The studio keeps print proportions, safe areas, and image quality close to
					the work. You can return to setup, change the format, or keep refining in
					the editor.
				</p>
				<Link className="text-link-v2" to="/formats">
					Explore formats <ArrowUpRight aria-hidden="true" />
				</Link>
			</section>
		</main>
	);
}
