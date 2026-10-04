import { describe, expect, it } from "bun:test";

import { resolveAuthSessionView } from "./auth-session-view";

describe("auth session view", () => {
	it("does not treat a pending session lookup as a guest", () => {
		expect(resolveAuthSessionView(false, true, false)).toBe("loading");
	});

	it("does not treat a failed session lookup as a guest", () => {
		expect(resolveAuthSessionView(false, false, true)).toBe("error");
	});

	it("reports guest only after a successful empty session lookup", () => {
		expect(resolveAuthSessionView(false, false, false)).toBe("anonymous");
	});

	it("keeps an existing session authenticated during background refresh or error", () => {
		expect(resolveAuthSessionView(true, true, false)).toBe("authenticated");
		expect(resolveAuthSessionView(true, false, true)).toBe("authenticated");
	});
});
