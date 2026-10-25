import { getProduct } from "@PhotoPrinting/api/domain/print";
import { Button } from "@PhotoPrinting/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";

import WorkspaceNav from "@/components/workspace-nav";
import { productImages } from "@/lib/creation-draft";
import { type DemoOrder, readDemoOrders } from "@/lib/demo-orders";
import { responsiveImage } from "@/lib/images";
import { useAuthSession } from "@/lib/use-auth-session";

export const Route = createFileRoute("/orders")({
	head: () => ({ meta: [{ title: "Your requests · printclub" }] }),
	component: OrdersPage,
});

const requestDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function OrdersPage() {
	const {
		session,
		state: sessionState,
		refetch: refetchSession,
	} = useAuthSession();
	const [orders, setOrders] = useState<DemoOrder[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	useEffect(() => {
		try {
			setOrders(readDemoOrders());
			setLoadError(null);
		} catch {
			setOrders(null);
			setLoadError(
				"Requests saved in this browser couldn’t be loaded. Check that site storage is available, then retry. Your saved data hasn’t been changed.",
			);
		}
	}, []);
	return (
		<main className="account-page workspace-page" id="main-content">
			<div className="account-shell enter-stagger">
				{sessionState === "authenticated" && session ? <WorkspaceNav /> : null}
				<header className="workspace-heading">
					<p className="eyebrow">Requests in this browser</p>
					<h1>Your studio requests</h1>
					<p className="account-lede">
						Demo requests sent from this browser appear here. Nothing is charged
						or printed in this demo.
					</p>
				</header>
				{sessionState === "error" ? (
					<div className="studio-dialog__error" role="alert">
						<span>We couldn’t check your sign-in status.</span>
						<Button
							type="button"
							variant="outline"
							onClick={() => void refetchSession()}
						>
							Try again
						</Button>
					</div>
				) : null}
				{loadError ? (
					<div className="studio-dialog__error" role="alert">
						<span>{loadError}</span>
						<Button
							type="button"
							variant="outline"
							onClick={() => window.location.reload()}
						>
							Retry
						</Button>
					</div>
				) : orders === null ? (
					<p className="creation-loading" role="status">
						Loading requests…
					</p>
				) : orders.length === 0 ? (
					<div className="empty-state">
						<PackageCheck aria-hidden="true" />
						<h2>No requests yet</h2>
						<p>
							Make a design and submit a demo request to see its reference in
							this browser. The request is not saved for staff review, emailed,
							or sent to a printer.
						</p>
						<Link className="button-v2 button-v2--primary" to="/create">
							Start a new print <ArrowUpRight aria-hidden="true" />
						</Link>
					</div>
				) : (
					<div className="request-list">
						{orders.map((order) => {
							const product = getProduct(order.productId);
							return (
								<article className="request-card" key={order.id}>
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
												{order.status === "local" ? "Local record" : "Received"}
											</span>
											<h2>{product?.name ?? order.productId}</h2>
											<p>
												{order.quantity} item{order.quantity === 1 ? "" : "s"} ·{" "}
												{requestDate.format(new Date(order.createdAt))}
											</p>
										</div>
									</div>
									<span>{order.contactEmail}</span>
								</article>
							);
						})}
					</div>
				)}
			</div>
		</main>
	);
}
