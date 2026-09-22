import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";

type DemoOrder = {
	id: string;
	productId: string;
	quantity: number;
	contactName: string;
	contactEmail: string;
	createdAt: string;
};

export const Route = createFileRoute("/orders")({
	head: () => ({ meta: [{ title: "Your requests · printclub" }] }),
	component: OrdersPage,
});

function OrdersPage() {
	const [orders, setOrders] = useState<DemoOrder[]>([]);
	useEffect(() => {
		try {
			setOrders(
				JSON.parse(
					localStorage.getItem("printclub:demo-orders") ?? "[]",
				) as DemoOrder[],
			);
		} catch {
			setOrders([]);
		}
	}, []);
	return (
		<main className="account-page" id="main-content">
			<div className="account-shell">
				<p className="eyebrow">Guest requests</p>
				<h1>Your studio requests</h1>
				<p className="account-lede">
					Requests saved in this browser appear here. Sign in when you want
					cloud projects, sharing, and order history.
				</p>
				{orders.length === 0 ? (
					<div className="empty-state">
						<PackageCheck aria-hidden="true" />
						<h2>No requests yet</h2>
						<p>
							Make a design in the studio and send it to the print studio for
							review.
						</p>
						<a className="button-link" href="/create">
							Start a new print <ArrowUpRight aria-hidden="true" />
						</a>
					</div>
				) : (
					<div className="request-list">
						{orders.map((order) => (
							<article className="request-card" key={order.id}>
								<div>
									<span className="request-card__status">Received</span>
									<h2>{order.productId}</h2>
									<p>
										{order.quantity} item{order.quantity === 1 ? "" : "s"} ·{" "}
										{new Date(order.createdAt).toLocaleDateString()}
									</p>
								</div>
								<span>{order.contactEmail}</span>
							</article>
						))}
					</div>
				)}
			</div>
		</main>
	);
}
