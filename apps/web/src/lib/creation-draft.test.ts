import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	createAssetFromFile,
	createCreationDraft,
	getCreationDraft,
	loadCreationDraft,
	readLegacyGuestDesign,
	saveCreationDraft,
	validateCreationDraft,
} from "./creation-draft";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalIndexedDb = Object.getOwnPropertyDescriptor(
	globalThis,
	"indexedDB",
);
let entries: Map<string, string>;
beforeEach(() => {
	entries = new Map();
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			localStorage: {
				getItem: (key: string) => entries.get(key) ?? null,
				setItem: (key: string, value: string) => entries.set(key, value),
			},
		},
	});
	Object.defineProperty(globalThis, "indexedDB", {
		configurable: true,
		value: undefined,
	});
});
afterEach(() => {
	if (originalWindow)
		Object.defineProperty(globalThis, "window", originalWindow);
	else Reflect.deleteProperty(globalThis, "window");
	if (originalIndexedDb)
		Object.defineProperty(globalThis, "indexedDB", originalIndexedDb);
	else Reflect.deleteProperty(globalThis, "indexedDB");
});

describe("draft recovery", () => {
	it("recovers the localStorage fallback after IndexedDB is unavailable", async () => {
		const draft = await createCreationDraft();
		await saveCreationDraft(draft);
		expect((await loadCreationDraft())?.id).toBe(draft.id);
		expect((await getCreationDraft(draft.id))?.document).toEqual(
			draft.document,
		);
	});
	it("keeps corrupted data and reports it rather than treating it as a blank design", async () => {
		const raw = '{"version":9}';
		entries.set("printclub:draft-fallback:bad", raw);
		await expect(getCreationDraft("bad")).rejects.toThrow();
		expect(entries.get("printclub:draft-fallback:bad")).toBe(raw);
		expect(() => validateCreationDraft(null)).toThrow();
	});
	it("legacy migration keeps the original until recovery succeeds", async () => {
		const draft = await createCreationDraft();
		const original = JSON.stringify(draft.document);
		entries.set("printclub:guest-document:v1", original);
		expect((await loadCreationDraft())?.document).toEqual(draft.document);
		expect(entries.get("printclub:guest-document:v1")).toBe(original);
	});
	it("does not leave a current-draft pointer when saving fails", async () => {
		Object.defineProperty(window.localStorage, "setItem", {
			value: () => {
				throw new DOMException("Quota exceeded", "QuotaExceededError");
			},
		});
		await expect(
			saveCreationDraft(await createCreationDraft()),
		).rejects.toThrow("Keep this tab open");
		expect(entries.has("printclub:current-draft-id:v1")).toBe(false);
	});
	it("does not silently discard damaged legacy data", () => {
		entries.set("printclub:guest-document:v1", "broken");
		expect(() => readLegacyGuestDesign()).toThrow();
		expect(entries.get("printclub:guest-document:v1")).toBe("broken");
	});
});

describe("photo import validation", () => {
	it("rejects empty, unsupported, oversized, and MIME-spoofed files before decoding", async () => {
		await expect(
			createAssetFromFile(new File([], "empty.png", { type: "image/png" })),
		).rejects.toThrow("empty");
		await expect(
			createAssetFromFile(
				new File(["x"], "photo.svg", { type: "image/svg+xml" }),
			),
		).rejects.toThrow("JPEG");
		await expect(
			createAssetFromFile(
				new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.png", {
					type: "image/png",
				}),
			),
		).rejects.toThrow("8 MB");
		await expect(
			createAssetFromFile(
				new File(["pretending to be an image"], "fake.png", {
					type: "image/png",
				}),
			),
		).rejects.toThrow("not a valid");
	});
});
