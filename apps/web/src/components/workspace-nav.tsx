import { Link } from "@tanstack/react-router";

const workspaceLinks = [
	{ to: "/dashboard", label: "Workspace" },
	{ to: "/orders", label: "Requests" },
	{ to: "/account", label: "Account" },
] as const;

export default function WorkspaceNav() {
	return (
		<nav className="workspace-nav" aria-label="Workspace">
			{workspaceLinks.map((link) => (
				<Link key={link.to} to={link.to}>
					{link.label}
				</Link>
			))}
		</nav>
	);
}
