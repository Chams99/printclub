import type { AppRouter } from "@PhotoPrinting/api/routers/index";
import { Toaster } from "@PhotoPrinting/ui/components/sonner";
import serifItalicLatin from "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url";
import interLatin from "@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2?url";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import Header from "../components/header";
import appCss from "../index.css?url";
import { developer, developerPerson } from "../lib/developer";

// Link previews need absolute URLs.
const siteUrl = "https://printclub.chames.tn";

const structuredData = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "WebSite",
			"@id": `${siteUrl}/#website`,
			url: `${siteUrl}/`,
			name: "printclub",
			description:
				"Turn the camera roll into a beautiful photo print with the printclub studio.",
			inLanguage: "en",
			creator: { "@id": developerPerson["@id"] },
		},
		developerPerson,
	],
};

// Headlines use both faces above the fold; preloading them avoids a visible font swap.
const fontPreloads = [interLatin, serifItalicLatin].map((href) => ({
	rel: "preload",
	href,
	as: "font",
	type: "font/woff2",
	crossOrigin: "anonymous" as const,
}));

export interface RouterAppContext {
	trpc: TRPCOptionsProxy<AppRouter>;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				name: "theme-color",
				content: "#fafaf8",
			},
			{
				title: "printclub — Your photos. Made to keep.",
			},
			{
				name: "description",
				content:
					"Turn the camera roll into a beautiful photo print with the printclub studio.",
			},
			// Link previews in chats and social posts.
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: "printclub" },
			{
				property: "og:title",
				content: "printclub — Your photos. Made to keep.",
			},
			{
				property: "og:description",
				content:
					"Turn the camera roll into a beautiful photo print with the printclub studio.",
			},
			{ property: "og:url", content: siteUrl },
			{ property: "og:image", content: `${siteUrl}/og-image.jpg` },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "author", content: developer.name },
		],
		scripts: [
			{
				type: "application/ld+json",
				children: JSON.stringify(structuredData),
			},
		],
		links: [
			{ rel: "author", href: developer.portfolio },
			...fontPreloads,
			{
				rel: "stylesheet",
				href: appCss,
			},
			{ rel: "icon", href: "/favicon.ico", sizes: "32x32" },
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/printclub-mark.svg",
			},
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			{ rel: "manifest", href: "/site.webmanifest" },
		],
	}),

	component: RootDocument,
});

function RootDocument() {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<div className="min-h-screen">
					<Header />
					<Outlet />
				</div>
				<Toaster richColors />
				<Scripts />
			</body>
		</html>
	);
}
