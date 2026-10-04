import type { DesignDocument } from "@PhotoPrinting/api/domain/print";
import { describe, expect, it } from "bun:test";
import {
	buildDesignExportSvg,
	canInlineExportPreview,
	createDesignExport,
	createSvgDataUrl,
	DesignExportError,
} from "./design-export";

const document: DesignDocument = {
	schemaVersion: 1,
	id: "design-1",
	productId: "classic-10x15",
	width: 300,
	height: 450,
	background: "#ffffff",
	updatedAt: "2026-09-23T00:00:00.000Z",
	elements: [
		{
			id: "photo-1",
			type: "image",
			assetId: "asset-1",
			x: 20,
			y: 30,
			width: 200,
			height: 150,
			rotation: 12,
			cropX: 0.25,
			cropY: 0.75,
			cropWidth: 1,
			cropHeight: 1,
		},
		{
			id: "text-1",
			type: "text",
			text: "Remember <today> & tomorrow",
			x: 24,
			y: 240,
			width: 250,
			height: 48,
			fontSize: 24,
			color: "#17181b",
			rotation: -4,
		},
		{
			id: "shape-1",
			type: "shape",
			shape: "blob",
			x: 10,
			y: 400,
			width: 60,
			height: 35,
			fill: "#3454d1",
			rotation: 0,
		},
	],
};

const assets = [
	{
		id: "asset-1",
		name: "photo.png",
		dataUrl:
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==",
		width: 1,
		height: 1,
	},
];

describe("export preview size policy", () => {
	it("keeps base64 previews bounded and leaves larger files downloadable", () => {
		expect(canInlineExportPreview(24 * 1024 * 1024)).toBe(true);
		expect(canInlineExportPreview(24 * 1024 * 1024 + 1)).toBe(false);
		expect(canInlineExportPreview(-1)).toBe(false);
		expect(canInlineExportPreview(Number.NaN)).toBe(false);
	});
});

async function withMockExportBrowser<T>(
	{
		imageWidth,
		imageHeight,
		fontsReady = Promise.resolve(),
		imageDecode = Promise.resolve(),
		toBlob = () => {},
	}: {
		imageWidth: number;
		imageHeight: number;
		fontsReady?: Promise<void>;
		imageDecode?: Promise<void>;
		toBlob?: HTMLCanvasElement["toBlob"];
	},
	run: () => Promise<T>,
) {
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const previousImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
	const context = {
		fillRect() {},
		drawImage() {},
		fillStyle: "",
	};
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => context,
		toBlob,
	} as unknown as HTMLCanvasElement;
	class MockImage {
		naturalWidth = imageWidth;
		naturalHeight = imageHeight;
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		src = "";

		decode() {
			return imageDecode;
		}
	}
	const mockWindow = {
		document: {
			fonts: { ready: fontsReady },
			createElement: () => canvas,
		},
		setTimeout: ((callback: TimerHandler) =>
			setTimeout(callback, 0)) as typeof window.setTimeout,
		clearTimeout: ((timer: number) =>
			clearTimeout(timer)) as typeof window.clearTimeout,
	} as unknown as Window & typeof globalThis;
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: mockWindow,
	});
	Object.defineProperty(globalThis, "Image", {
		configurable: true,
		value: MockImage,
	});

	try {
		return await run();
	} finally {
		if (previousWindow) {
			Object.defineProperty(globalThis, "window", previousWindow);
		} else {
			Reflect.deleteProperty(globalThis, "window");
		}
		if (previousImage) {
			Object.defineProperty(globalThis, "Image", previousImage);
		} else {
			Reflect.deleteProperty(globalThis, "Image");
		}
	}
}

describe("design export SVG", () => {
	it("preserves crop focal point, layer rotation, text escaping, and shape appearance", () => {
		const svg = buildDesignExportSvg(document, assets);

		expect(svg).toContain('viewBox="0 0 300 450"');
		expect(svg).toContain("rotate(12 120 105)");
		expect(svg).toContain('x="0" y="-37.5"');
		const horizontalCropDocument = {
			...document,
			elements: document.elements.map((element) =>
				element.type === "image"
					? { ...element, width: 100, height: 200 }
					: element,
			),
		} satisfies DesignDocument;
		expect(buildDesignExportSvg(horizontalCropDocument, assets)).toContain(
			'x="-25" y="0"',
		);
		expect(svg).toContain("Remember &lt;today&gt; &amp; tomorrow");
		expect(svg).toContain("font-family:Georgia,serif");
		expect(svg).toContain("rotate(-4 149 264)");
		expect(svg).toContain("<path d=");
		expect(svg).toContain('opacity="0.88"');
	});

	it("explains when a design references an asset that is no longer available", () => {
		expect(() => buildDesignExportSvg(document, [])).toThrow(
			"A photo in this design is missing. Re-add the photo, then export again.",
		);
	});

	it("rejects unsafe or unsupported asset URLs instead of embedding remote content", () => {
		expect(() =>
			buildDesignExportSvg(document, [
				{ ...assets[0], dataUrl: "https://example.com/photo.png" },
			]),
		).toThrow(DesignExportError);
	});

	it("rejects MIME types that do not match the embedded image signature", () => {
		expect(() =>
			buildDesignExportSvg(document, [
				{ ...assets[0], dataUrl: "data:image/png;base64,/9j/4AAQ" },
			]),
		).toThrow("A photo in this design could not be read.");
	});

	it("rejects malformed base64 after a valid image signature", () => {
		expect(() =>
			buildDesignExportSvg(document, [
				{
					...assets[0],
					dataUrl: `data:image/png;base64,iVBORw0KGgoA${"A".repeat(12)}A=`,
				},
			]),
		).toThrow("A photo in this design could not be read.");
	});

	it("creates an encoded SVG data URL without changing the SVG payload", () => {
		const svg = buildDesignExportSvg(document, assets);
		const dataUrl = createSvgDataUrl(svg);

		expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
		expect(decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1))).toBe(
			svg,
		);
	});

	it("uses the same implicit text dimensions as the editor", () => {
		const withoutHeight = {
			...document,
			elements: document.elements.map((element) => {
				if (element.type !== "text") return element;
				const { height: _height, ...text } = element;
				return { ...text, fontSize: 42 };
			}),
		} satisfies DesignDocument;
		const svg = buildDesignExportSvg(withoutHeight, assets);

		expect(svg).toContain('width="250" height="54.6"');
	});

	it("rejects malformed documents and oversized SVG payloads with actionable errors", () => {
		expect(() =>
			buildDesignExportSvg({ ...document, width: Number.NaN }, assets),
		).toThrow("This design has invalid or unsupported content.");
		const largeAsset = {
			...assets[0],
			dataUrl: `data:image/png;base64,iVBORw0KGgoA${"A".repeat(33 * 1024 * 1024)}`,
		};
		expect(() => buildDesignExportSvg(document, [largeAsset])).toThrow(
			"This design is too large to export in this browser.",
		);
	});

	it("bounds font readiness and a canvas encoder that never calls back", async () => {
		await withMockExportBrowser(
			{
				imageWidth: 1,
				imageHeight: 1,
				fontsReady: new Promise<void>(() => {}),
			},
			async () => {
				await expect(
					createDesignExport(document, assets, { format: "png" }),
				).rejects.toMatchObject({ code: "encode-failed" });
			},
		);
	});

	it("rejects a timed-out or dimension-mismatched source image before SVG export", async () => {
		await withMockExportBrowser(
			{
				imageWidth: 1,
				imageHeight: 1,
				imageDecode: new Promise<void>(() => {}),
			},
			async () => {
				await expect(
					createDesignExport(document, assets, { format: "svg" }),
				).rejects.toMatchObject({ code: "invalid-asset" });
			},
		);
		await withMockExportBrowser({ imageWidth: 2, imageHeight: 1 }, async () => {
			await expect(
				createDesignExport(document, assets, { format: "svg" }),
			).rejects.toMatchObject({ code: "invalid-asset" });
		});
	});
});
