import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import startServer from "./dist/server/server.js";

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOST ?? "0.0.0.0";
const clientRoot = fileURLToPath(new URL("./dist/client/", import.meta.url));
const clientRootPrefix = clientRoot.endsWith(sep)
	? clientRoot
	: `${clientRoot}${sep}`;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
	throw new Error("PORT must be an integer between 1 and 65535");
}

async function serveStatic(pathname) {
	let decodedPathname;
	try {
		decodedPathname = decodeURIComponent(pathname);
	} catch {
		return null;
	}

	const filePath = resolve(clientRoot, `.${decodedPathname}`);
	if (filePath !== clientRoot && !filePath.startsWith(clientRootPrefix)) {
		return null;
	}

	const file = Bun.file(filePath);
	if (!(await file.exists())) return null;

	const isHashedAsset = decodedPathname.startsWith("/assets/");
	return new Response(file, {
		headers: {
			"Cache-Control": isHashedAsset
				? "public, max-age=31536000, immutable"
				: "public, max-age=3600",
			"Content-Type": file.type,
		},
	});
}

const server = Bun.serve({
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === "/health") {
			return Response.json({ status: "ok" });
		}
		if (request.method === "GET" || request.method === "HEAD") {
			const staticResponse = await serveStatic(url.pathname);
			if (staticResponse) return staticResponse;
		}
		return startServer.fetch(request);
	},
	hostname,
	port,
});

console.log(
	`Web server is running on http://${server.hostname}:${server.port}`,
);
