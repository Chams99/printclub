import { Button } from "@PhotoPrinting/ui/components/button";
import { Skeleton } from "@PhotoPrinting/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { CircleAlert, RotateCw } from "lucide-react";
import { lazy, Suspense } from "react";

import { useAuthSession } from "@/lib/use-auth-session";

const AccountMenu = lazy(() => import("./account-menu"));

export default function UserMenu({
	mobileMenuSummaryRef,
}: {
	mobileMenuSummaryRef: { current: HTMLElement | null };
}) {
	const { session, state, refetch } = useAuthSession();

	if (state === "loading") {
		return <Skeleton className="user-menu__skeleton" aria-hidden="true" />;
	}

	if (state === "error") {
		return (
			<Button
				variant="ghost"
				className="user-menu__trigger"
				title="We couldn’t check your account. Try again."
				aria-label="Retry account status check"
				onClick={() => void refetch()}
			>
				<CircleAlert aria-hidden="true" />
				<span>Retry</span>
				<RotateCw aria-hidden="true" />
			</Button>
		);
	}

	if (state === "anonymous" || !session) {
		return (
			<Button
				variant="ghost"
				className="user-menu__trigger"
				nativeButton={false}
				render={<Link to="/login" search={{}} />}
			>
				Sign in
			</Button>
		);
	}

	return (
		<Suspense
			fallback={<Skeleton className="user-menu__skeleton" aria-hidden="true" />}
		>
			<AccountMenu
				name={session.user.name}
				email={session.user.email}
				mobileMenuSummaryRef={mobileMenuSummaryRef}
			/>
		</Suspense>
	);
}
