import { afterEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import {
	createServerListenOptions,
	maxRequestBodyBytes,
} from "./request-body-limit";

describe("server request body limit", () => {
	let stopServer: (() => void) | undefined;

	afterEach(() => {
		stopServer?.();
		stopServer = undefined;
	});

	it("rejects a streamed request over the cap without Content-Length", async () => {
		const app = new Elysia()
			.post("/", async ({ request }) => {
				await request.arrayBuffer();
				return "accepted";
			})
			.listen(createServerListenOptions("127.0.0.1", 0));
		stopServer = () => app.stop();
		const port = app.server?.port;
		expect(port).toBeDefined();
		const address = `http://127.0.0.1:${port}`;

		const acceptedResponse = await fetch(address, {
			method: "POST",
			body: streamedBody(maxRequestBodyBytes - 1),
			duplex: "half",
		});
		expect(acceptedResponse.status).toBe(200);

		const rejectedResponse = await fetch(address, {
			method: "POST",
			body: streamedBody(maxRequestBodyBytes + 1),
			duplex: "half",
		});
		expect(rejectedResponse.status).toBe(413);
	});
});

function streamedBody(length: number) {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			const chunkSize = 1024 * 1024;
			for (let remaining = length; remaining > 0; remaining -= chunkSize) {
				controller.enqueue(new Uint8Array(Math.min(chunkSize, remaining)));
			}
			controller.close();
		},
	});
}
