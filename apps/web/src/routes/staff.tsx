import { ClipboardList, ExternalLink } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type DemoOrder = { id: string; productId: string; quantity: number; contactName: string; contactEmail: string; createdAt: string };

export const Route = createFileRoute("/staff")({
	head: () => ({ meta: [{ title: "Studio queue · printclub" }] }),
	component: StaffPage,
});

function StaffPage() {
	if (import.meta.env.PROD) {
		return (
			<main className="account-page" id="main-content">
				<div className="account-shell">
					<p className="eyebrow">Staff access</p>
					<h1>Staff preview is disabled</h1>
					<p className="account-lede">
						This browser-local operations preview is available during development
						only. A production staff area requires server-side roles and audit
						logging.
					</p>
				</div>
			</main>
		);
	}

	const [orders, setOrders] = useState<DemoOrder[]>([]);
	useEffect(() => { try { setOrders(JSON.parse(localStorage.getItem("printclub:demo-orders") ?? "[]") as DemoOrder[]); } catch { setOrders([]); } }, []);
	return <main className="account-page" id="main-content"><div className="account-shell"><div className="staff-heading"><div><p className="eyebrow">Demo operations</p><h1>Studio queue</h1><p className="account-lede">A local-only staff view for reviewing demo requests. Production access must be protected by a server-side staff role before launch.</p></div><ClipboardList aria-hidden="true" /></div>{orders.length === 0 ? <div className="empty-state"><h2>Queue is clear</h2><p>Submit a request from the studio to see it appear here.</p></div> : <div className="request-list">{orders.map((order) => <article className="request-card request-card--staff" key={order.id}><div><span className="request-card__status">New request</span><h2>{order.productId}</h2><p>{order.contactName} · {order.contactEmail}</p></div><div><strong>Qty {order.quantity}</strong><a href="/studio">Open studio <ExternalLink aria-hidden="true" /></a></div></article>)}</div>}</div></main>;
}
