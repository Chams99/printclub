import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	FolderOpen,
	Link as LinkIcon,
	ShieldCheck,
	Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_auth/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	const { session } = Route.useRouteContext();
	const name = session.data?.user.name ?? "there";
	return (
		<main className="account-page" id="main-content">
			<div className="account-shell">
				<p className="eyebrow">Your printclub</p>
				<h1>Welcome, {name.split(" ")[0]}.</h1>
				<p className="account-lede">
					Start with a guided setup, then open the studio when your format and
					photos are ready. Cloud project storage is not connected in this demo.
				</p>
				<div className="dashboard-grid">
					<a className="dashboard-card" href="/create">
						<Sparkles aria-hidden="true" />
						<span>
							<strong>Create a print</strong>
							<small>Choose a format and prepare a design</small>
						</span>
						<ArrowUpRight aria-hidden="true" />
					</a>
					<Link className="dashboard-card" to="/orders">
						<FolderOpen aria-hidden="true" />
						<span>
							<strong>Request history</strong>
							<small>Review browser demo requests</small>
						</span>
						<ArrowUpRight aria-hidden="true" />
					</Link>
					<div className="dashboard-card dashboard-card--quiet">
						<ShieldCheck aria-hidden="true" />
						<span>
							<strong>Account protected</strong>
							<small>Better Auth session active</small>
						</span>
					</div>
					<Link className="dashboard-card" to="/account">
						<LinkIcon aria-hidden="true" />
						<span>
							<strong>Sign-in methods</strong>
							<small>Verify your email and connect Google</small>
						</span>
						<ArrowUpRight aria-hidden="true" />
					</Link>
				</div>
			</div>
		</main>
	);
}
