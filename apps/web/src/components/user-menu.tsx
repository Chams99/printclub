import { Button } from "@PhotoPrinting/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@PhotoPrinting/ui/components/dropdown-menu";
import { Skeleton } from "@PhotoPrinting/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Link to="/login" search={{}}>
				<Button variant="outline">Sign In</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="outline" className="user-menu__trigger" />}
			>
				{session.user.name}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="user-menu__content" align="end">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="user-menu__label">
						My account
					</DropdownMenuLabel>
					<DropdownMenuLabel className="user-menu__email">
						{session.user.email}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="user-menu__item"
						render={<Link to="/account" />}
					>
						Account settings
					</DropdownMenuItem>
					<DropdownMenuItem
						className="user-menu__item"
						variant="destructive"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										navigate({
											to: "/",
										});
									},
								},
							});
						}}
					>
						Sign Out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
