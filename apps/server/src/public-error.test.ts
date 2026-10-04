import { cors } from "@elysiajs/cors";
import { describe, expect, it } from "bun:test";
import { Elysia, status } from "elysia";

import {
	mapPublicServerError,
	publicServerErrorHandler,
} from "./public-error";

describe("mapPublicServerError", () => {
	it("returns a stable internal error without backend details", () => {
		expect(mapPublicServerError({ code: "UNKNOWN", status: 500 })).toEqual({
			status: 500,
			body: {
				code: "INTERNAL_SERVER_ERROR",
				message: "Printclub is having trouble right now. Please try again.",
			},
		});
	});

	it("keeps upstream server statuses while masking their messages", () => {
		expect(mapPublicServerError({ code: "UNKNOWN", status: 502 })?.status).toBe(
			502,
		);
	});

	it("maps UNKNOWN errors to 500 when the prior response status was 200", () => {
		expect(mapPublicServerError({ code: "UNKNOWN", status: 200 })).toEqual({
			status: 500,
			body: {
				code: "INTERNAL_SERVER_ERROR",
				message: "Printclub is having trouble right now. Please try again.",
			},
		});
	});

	it("maps validation and parse failures to stable user messages", () => {
		expect(mapPublicServerError({ code: "VALIDATION", status: 422 })).toEqual({
			status: 422,
			body: {
				code: "VALIDATION",
				message: "Check the submitted information and try again.",
			},
		});
		expect(
			mapPublicServerError({ code: "PARSE", status: 400 })?.body.code,
		).toBe("PARSE_ERROR");
		expect(mapPublicServerError({ code: "VALIDATION", status: 200 })?.status).toBe(
			422,
		);
		expect(mapPublicServerError({ code: "PARSE", status: 200 })?.status).toBe(400);
	});

	it("leaves native not-found and explicit status responses alone", () => {
		expect(mapPublicServerError({ code: "NOT_FOUND", status: 404 })).toBeNull();
		expect(mapPublicServerError({ code: 429, status: 429 })).toBeNull();
		expect(mapPublicServerError({ code: "UNKNOWN", status: 429 })?.status).toBe(
			500,
		);
	});
});

describe("publicServerErrorHandler integration", () => {
	it("returns a safe 500 for a thrown Elysia route error", async () => {
		const app = new Elysia()
			.use(
				cors({
					origin: "https://client.example",
					credentials: true,
					exposeHeaders: ["Retry-After", "RateLimit-Limit"],
				}),
			)
			.onError(publicServerErrorHandler)
			.get("/throws", ({ set }) => {
				set.status = 200;
				throw new Error("private provider endpoint and token");
			});

		const response = await app.handle(
			new Request("http://localhost/throws", {
				headers: { Origin: "https://client.example" },
			}),
		);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body).toEqual({
			code: "INTERNAL_SERVER_ERROR",
			message: "Printclub is having trouble right now. Please try again.",
		});
		expect(response.headers.get("access-control-allow-origin")).toBe(
			"https://client.example",
		);
		expect(response.headers.get("access-control-allow-credentials")).toBe(
			"true",
		);
		expect(JSON.stringify(body)).not.toContain("private provider");
	});

	it("keeps rate-limit headers and exposes them across origins", async () => {
		const app = new Elysia()
			.use(
				cors({
					origin: "https://client.example",
					credentials: true,
					exposeHeaders: ["Retry-After", "RateLimit-Limit"],
				}),
			)
			.onRequest(({ set }) => {
				set.headers["Retry-After"] = "10";
				set.headers["RateLimit-Limit"] = "30";
				return status(429);
			})
			.onError(publicServerErrorHandler)
			.get("/limited", () => ({ ok: true }));

		const response = await app.handle(
			new Request("http://localhost/limited", {
				headers: { Origin: "https://client.example" },
			}),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("access-control-allow-origin")).toBe(
			"https://client.example",
		);
		expect(response.headers.get("access-control-allow-credentials")).toBe(
			"true",
		);
		expect(response.headers.get("retry-after")).toBe("10");
		expect(response.headers.get("ratelimit-limit")).toBe("30");
		expect(response.headers.get("access-control-expose-headers")).toBe(
			"Retry-After, RateLimit-Limit",
		);
	});
});
