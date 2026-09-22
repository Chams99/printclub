import startServer from "./dist/server/server.js";

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
	throw new Error("PORT must be an integer between 1 and 65535");
}

const server = Bun.serve({
	fetch(request) {
		if (new URL(request.url).pathname === "/health") {
			return Response.json({ status: "ok" });
		}
		return startServer.fetch(request);
	},
	hostname,
	port,
});

console.log(
	`Web server is running on http://${server.hostname}:${server.port}`,
);
