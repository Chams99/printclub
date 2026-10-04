import type { AppRouter } from "@PhotoPrinting/api/routers/index";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import Loader from "./components/loader";
import NotFound from "./components/not-found";
import { RouteError } from "./components/route-error";
import { routeTree } from "./routeTree.gen";
import { ENV } from "./runtime-env";
import { TRPCProvider } from "./utils/trpc";

function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (_error, query) => {
				toast.error(
					"This information could not be loaded. Try again in a moment.",
					{
						action: {
							label: "Retry",
							onClick: () => {
								void query.fetch().catch(() => {});
							},
						},
					},
				);
			},
		}),
		defaultOptions: {
			queries: { staleTime: 60 * 1000, retry: 1 },
			mutations: { retry: false },
		},
	});
}

const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/trpc`,
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: "include",
					signal: options?.signal
						? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)])
						: AbortSignal.timeout(20_000),
				});
			},
		}),
	],
});

export const getRouter = () => {
	const queryClient = createQueryClient();
	const trpc = createTRPCOptionsProxy({
		client: trpcClient,
		queryClient,
	});

	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		// CSS enables smooth scrolling for in-page anchors; route changes should still jump.
		scrollRestorationBehavior: "instant",
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Crossfade between pages, but not when only search params change (e.g. creation steps).
		defaultViewTransition: {
			types: ({ pathChanged }) => (pathChanged ? ["page"] : false),
		},
		context: { trpc, queryClient },
		defaultPendingComponent: () => <Loader />,
		defaultNotFoundComponent: () => <NotFound />,
		defaultErrorComponent: RouteError,
		Wrap: ({ children }) => (
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{children}
			</TRPCProvider>
		),
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
};

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
