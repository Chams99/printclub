import { ArrowUpRight, MessageCircle, Phone } from "lucide-react";

import { developer } from "../lib/developer";

/** A quiet note in the footer: who built printclub, and how to reach him. */
export default function MadeBy() {
	return (
		<section className="made-by" aria-labelledby="made-by-title">
			<div>
				<h2 id="made-by-title">Need a website like this one?</h2>
				<p className="made-by__text">
					Designed and built by{" "}
					<a href={developer.portfolioHref} rel="author">
						{developer.name}
					</a>
					, {developer.role}.
				</p>
			</div>
			<ul>
				<li>
					<a className="made-by__link" href={developer.phoneHref}>
						<Phone className="made-by__icon" aria-hidden="true" />
						{developer.phone}
					</a>
				</li>
				<li>
					<a className="made-by__link" href={developer.whatsappHref}>
						<MessageCircle className="made-by__icon" aria-hidden="true" />
						WhatsApp
					</a>
				</li>
				<li>
					<a className="made-by__link" href={developer.portfolioHref}>
						chames.tn
						<ArrowUpRight className="made-by__icon" aria-hidden="true" />
					</a>
				</li>
			</ul>
		</section>
	);
}
