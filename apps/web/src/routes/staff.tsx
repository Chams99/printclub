import { getProduct } from "@PhotoPrinting/api/domain/print";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionNotice } from "@/components/action-notice";
import { productImages } from "@/lib/creation-draft";
import { type DemoOrder, readDemoOrders } from "@/lib/demo-orders";
import { responsiveImage } from "@/lib/images";

export const Route = createFileRoute("/staff")({
	head: () => ({ meta: [{ title: "Studio queue · printclub" }] }),
	component: StaffPage,
});

const requestDate = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

function StaffPage() {
	// A build-time constant, but keep hooks out of the branch all the same.
	return import.meta.env.PROD ? <StaffDisabled /> : <StaffQueue />;
}

function StaffDisabled() {
	return (
		<main className="account-page workspace-page" id="main-content">
			<div className="account-shell enter-stagger">
				<header className="workspace-heading">
					<p className="eyebrow">Staff access</p>
					<h1>Staff preview is disabled</h1>
					<p className="account-lede">
						This browser-local operations preview is available during
						development only. A production staff area requires server-side roles
						and audit logging.
					</p>
				</header>
			</div>
		</main>
	);
}

function StaffQueue() {
	const [orders, setOrders] = useState<DemoOrder[]>([]);
	const [error, setError] = useState<string>();
	const [attempt, setAttempt] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly reruns the storage read after Retry.
	useEffect(() => {
		try {
			setOrders(readDemoOrders());
			setError(undefined);
		} catch {
			setError(
				"The browser request history could not be read. Allow site storage and retry. Existing records have been kept.",
			);
		}
	}, [attempt]);

	return (
		<main className="account-page workspace-page" id="main-content">
			<div className="account-shell enter-stagger">
				<header className="workspace-heading staff-heading">
					<div>
						<p className="eyebrow">Demo operations · development only</p>
						<h1>Studio queue</h1>
						<p className="account-lede">
							A local-only staff view for reviewing demo requests. Production
							access must be protected by a server-side staff role before
							launch.
						</p>
					</div>
					<ClipboardList aria-hidden="true" />
				</header>
				{error ? (
					<ActionNotice title="Queue could not be loaded" message={error}>
						<button
							className="button-v2 button-v2--ghost"
							type="button"
							onClick={() => setAttempt((value) => value + 1)}
						>
							Retry
						</button>
					</ActionNotice>
				) : orders.length === 0 ? (
					<div className="empty-state">
						<ClipboardList aria-hidden="true" />
						<h2>Queue is clear</h2>
						<p>Submit a request from the studio to see it appear here.</p>
					</div>
				) : (
					<div className="request-list">
						{orders.map((order) => {
							const product = getProduct(order.productId);
							return (
								<article
									className="request-card request-card--staff"
									key={order.id}
								>
									<div className="request-card__main">
										<img
											className="request-card__thumb"
											{...responsiveImage(
												productImages[product?.kind ?? "classic-print"] ??
													"/images/printclub-hero.webp",
												"52px",
											)}
											alt=""
										/>
										<div>
											<span className="request-card__status">
												{order.status === "local"
													? "Local record"
													: "Demo request"}
											</span>
											<h2>{product?.name ?? order.productId}</h2>
											<p>
												{order.contactName} · {order.contactEmail}
											</p>
											<p>{requestDate.format(new Date(order.createdAt))}</p>
										</div>
									</div>
									<div>
										<strong>Qty {order.quantity}</strong>
										{order.draftId ? (
											<Link to="/studio" search={{ draft: order.draftId }}>
												Open studio <ArrowUpRight aria-hidden="true" />
											</Link>
										) : (
											<small>Design link unavailable</small>
										)}
									</div>
								</article>
							);
						})}
					</div>
				)}
			</div>
		</main>
	);
}
