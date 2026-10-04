import {
	type DesignDocument,
	type DesignElement,
	designDocumentSchema,
} from "@PhotoPrinting/api/domain/print";

export type ExportFormat = "png" | "jpeg" | "svg";

export type ExportAsset = {
	id: string;
	name: string;
	dataUrl: string;
	width: number;
	height: number;
};

export type ExportStage =
	| "preparing"
	| "rendering"
	| "encoding"
	| "downloading";

export type DesignExportOptions = {
	format: ExportFormat;
	quality?: number;
	onProgress?: (stage: ExportStage) => void;
};

const MAX_EXPORT_PIXELS = 36_000_000;
const MAX_SVG_BYTES = 32 * 1024 * 1024;
export const MAX_INLINE_EXPORT_PREVIEW_BYTES = 24 * 1024 * 1024;
const IMAGE_DECODE_TIMEOUT_MS = 15_000;
const ASSET_VALIDATION_TIMEOUT_MS = 30_000;
const FONT_READY_TIMEOUT_MS = 5_000;
const ENCODE_TIMEOUT_MS = 30_000;

export function canInlineExportPreview(byteLength: number) {
	return (
		Number.isSafeInteger(byteLength) &&
		byteLength >= 0 &&
		byteLength <= MAX_INLINE_EXPORT_PREVIEW_BYTES
	);
}

export type ExportErrorCode =
	| "invalid-document"
	| "missing-asset"
	| "invalid-asset"
	| "export-too-large"
	| "canvas-unavailable"
	| "image-decode-failed"
	| "encode-failed"
	| "export-failed";

const exportErrorMessages: Record<ExportErrorCode, string> = {
	"invalid-document":
		"This design has invalid or unsupported content. Reopen it and try exporting again.",
	"missing-asset":
		"A photo in this design is missing. Re-add the photo, then export again.",
	"invalid-asset":
		"A photo in this design could not be read. Re-add it and try again.",
	"export-too-large":
		"This design is too large to export in this browser. Reduce the canvas size or export an SVG preview.",
	"canvas-unavailable":
		"Your browser could not start image export. Try a current version of Chrome, Edge, Firefox, or Safari.",
	"image-decode-failed":
		"A photo or font could not be prepared for export. Check that the design assets are available, then try again.",
	"encode-failed":
		"The browser could not create the image file. Try SVG preview or reduce the design size.",
	"export-failed":
		"The export did not finish. Check that your browser allows downloads, then try again.",
};

export class DesignExportError extends Error {
	readonly code: ExportErrorCode;

	constructor(code: ExportErrorCode, cause?: unknown) {
		super(exportErrorMessages[code], { cause });
		this.name = "DesignExportError";
		this.code = code;
	}
}

export function getDesignExportErrorMessage(error: unknown) {
	if (error instanceof DesignExportError) return error.message;
	if (error instanceof DOMException && error.name === "SecurityError") {
		return "The browser blocked image export because a photo came from an untrusted source. Re-add the photo from your device and try again.";
	}
	return exportErrorMessages["export-failed"];
}

function escapeXml(value: string) {
	return value.replace(/[<>&'"]/g, (character) => {
		const entities: Record<string, string> = {
			"<": "&lt;",
			">": "&gt;",
			"&": "&amp;",
			"'": "&apos;",
			'"': "&quot;",
		};
		return entities[character] ?? character;
	});
}

function assetDataUrlIsSupported(value: string) {
	const match = /^data:image\/(jpeg|png|webp);base64,([a-z\d+/]*={0,2})$/i.exec(
		value,
	);
	if (!match) return false;
	const payload = match[2];
	const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
	if (
		payload.length % 4 !== 0 ||
		payload.slice(0, payload.length - padding).includes("=")
	) {
		return false;
	}
	try {
		const signature = atob(payload.slice(0, 24));
		const bytes = Array.from(signature, (character) => character.charCodeAt(0));
		if (match[1].toLowerCase() === "png") {
			return [137, 80, 78, 71, 13, 10, 26, 10].every(
				(byte, index) => bytes[index] === byte,
			);
		}
		if (match[1].toLowerCase() === "jpeg") {
			return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
		}
		return (
			bytes[0] === 82 &&
			bytes[1] === 73 &&
			bytes[2] === 70 &&
			bytes[3] === 70 &&
			bytes[8] === 87 &&
			bytes[9] === 69 &&
			bytes[10] === 66 &&
			bytes[11] === 80
		);
	} catch {
		return false;
	}
}

function formatNumber(value: number) {
	return Number.isInteger(value)
		? String(value)
		: String(Number(value.toFixed(4)));
}

function imageElementSvg(
	element: Extract<DesignElement, { type: "image" }>,
	asset: ExportAsset,
) {
	if (
		!Number.isFinite(asset.width) ||
		!Number.isFinite(asset.height) ||
		asset.width <= 0 ||
		asset.height <= 0
	) {
		throw new DesignExportError("invalid-asset");
	}
	const scale = Math.max(
		element.width / asset.width,
		element.height / asset.height,
	);
	const renderedWidth = asset.width * scale;
	const renderedHeight = asset.height * scale;
	const offsetX = (element.width - renderedWidth) * element.cropX;
	const offsetY = (element.height - renderedHeight) * element.cropY;
	const cx = element.x + element.width / 2;
	const cy = element.y + element.height / 2;
	const rotation = element.rotation
		? ` transform="rotate(${formatNumber(element.rotation)} ${formatNumber(cx)} ${formatNumber(cy)})"`
		: "";
	return `<svg x="${formatNumber(element.x)}" y="${formatNumber(element.y)}" width="${formatNumber(element.width)}" height="${formatNumber(element.height)}" viewBox="0 0 ${formatNumber(element.width)} ${formatNumber(element.height)}" overflow="hidden"${rotation}><image href="${asset.dataUrl}" x="${formatNumber(offsetX)}" y="${formatNumber(offsetY)}" width="${formatNumber(renderedWidth)}" height="${formatNumber(renderedHeight)}" preserveAspectRatio="none" /></svg>`;
}

function shapeSvg(element: Extract<DesignElement, { type: "shape" }>) {
	const { x, y, width, height } = element;
	const fill = escapeXml(element.fill);
	const rotation = element.rotation
		? ` transform="rotate(${formatNumber(element.rotation)} ${formatNumber(x + width / 2)} ${formatNumber(y + height / 2)})"`
		: "";
	const opacity = ' opacity="0.88"';
	if (element.shape === "circle") {
		return `<ellipse cx="${formatNumber(x + width / 2)}" cy="${formatNumber(y + height / 2)}" rx="${formatNumber(width / 2)}" ry="${formatNumber(height / 2)}" fill="${fill}"${opacity}${rotation} />`;
	}
	if (element.shape === "blob") {
		return `<path d="M ${formatNumber(x + width * 0.5)} ${formatNumber(y)} C ${formatNumber(x + width * 0.78)} ${formatNumber(y - height * 0.04)}, ${formatNumber(x + width * 1.04)} ${formatNumber(y + height * 0.2)}, ${formatNumber(x + width * 0.94)} ${formatNumber(y + height * 0.5)} C ${formatNumber(x + width * 1.02)} ${formatNumber(y + height * 0.79)}, ${formatNumber(x + width * 0.72)} ${formatNumber(y + height * 1.03)}, ${formatNumber(x + width * 0.48)} ${formatNumber(y + height * 0.94)} C ${formatNumber(x + width * 0.19)} ${formatNumber(y + height * 1.04)}, ${formatNumber(x - width * 0.03)} ${formatNumber(y + height * 0.78)}, ${formatNumber(x + width * 0.06)} ${formatNumber(y + height * 0.5)} C ${formatNumber(x - width * 0.02)} ${formatNumber(y + height * 0.22)}, ${formatNumber(x + width * 0.22)} ${formatNumber(y - height * 0.03)}, ${formatNumber(x + width * 0.5)} ${formatNumber(y)} Z" fill="${fill}"${opacity}${rotation} />`;
	}
	if (element.shape === "triangle") {
		return `<polygon points="${formatNumber(x + width / 2)},${formatNumber(y)} ${formatNumber(x + width)},${formatNumber(y + height)} ${formatNumber(x)},${formatNumber(y + height)}" fill="${fill}"${opacity}${rotation} />`;
	}
	if (element.shape === "star") {
		const points = Array.from({ length: 10 }, (_, index) => {
			const angle = -Math.PI / 2 + (index * Math.PI) / 5;
			const radius = index % 2 === 0 ? 0.5 : 0.22;
			return `${formatNumber(x + width / 2 + Math.cos(angle) * width * radius)},${formatNumber(y + height / 2 + Math.sin(angle) * height * radius)}`;
		}).join(" ");
		return `<polygon points="${points}" fill="${fill}"${opacity}${rotation} />`;
	}
	return `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="${element.shape === "line" ? formatNumber(height / 2) : "0"}" fill="${fill}"${opacity}${rotation} />`;
}

function textSvg(
	element: Extract<DesignElement, { type: "text" }>,
	document: DesignDocument,
) {
	const width = element.width ?? document.width * 0.8;
	const height = element.height ?? Math.max(32, element.fontSize * 1.3);
	const transform = element.rotation
		? ` transform="rotate(${formatNumber(element.rotation)} ${formatNumber(element.x + width / 2)} ${formatNumber(element.y + height / 2)})"`
		: "";
	const color = escapeXml(element.color);
	const text = escapeXml(element.text);
	return `<foreignObject x="${formatNumber(element.x)}" y="${formatNumber(element.y)}" width="${formatNumber(width)}" height="${formatNumber(height)}"${transform}><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:100%;height:100%;min-width:3rem;padding:.15rem;display:flex;align-items:center;justify-content:center;overflow:hidden;overflow-wrap:anywhere;white-space:normal;text-align:center;font-family:Georgia,serif;font-size:${formatNumber(element.fontSize)}px;font-weight:650;line-height:1.15;color:${color}">${text}</div></foreignObject>`;
}

export function buildDesignExportSvg(
	inputDocument: DesignDocument,
	assets: readonly ExportAsset[],
) {
	const parsed = designDocumentSchema.safeParse(inputDocument);
	if (!parsed.success)
		throw new DesignExportError("invalid-document", parsed.error);
	const document = parsed.data;
	const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
	const usedAssets = new Set(
		document.elements.flatMap((element) =>
			element.type === "image" ? [element.assetId] : [],
		),
	);
	for (const id of usedAssets) {
		const asset = assetsById.get(id);
		if (!asset) throw new DesignExportError("missing-asset");
		// Data URLs are ASCII, so this is a cheap lower bound that avoids copying
		// an obviously oversized image into an SVG string and then into an encoder.
		if (asset.dataUrl.length > MAX_SVG_BYTES)
			throw new DesignExportError("export-too-large");
		if (!assetDataUrlIsSupported(asset.dataUrl))
			throw new DesignExportError("invalid-asset");
	}
	const encoder = new TextEncoder();
	const parts = [
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}"><rect width="100%" height="100%" fill="${escapeXml(document.background)}" />`,
	];
	let byteLength = encoder.encode(parts[0]).byteLength;
	for (const element of document.elements) {
		let part: string;
		if (element.type === "text") part = textSvg(element, document);
		else if (element.type === "shape") part = shapeSvg(element);
		else {
			const asset = assetsById.get(element.assetId);
			if (!asset) throw new DesignExportError("missing-asset");
			part = imageElementSvg(element, asset);
		}
		byteLength += encoder.encode(part).byteLength;
		if (byteLength > MAX_SVG_BYTES)
			throw new DesignExportError("export-too-large");
		parts.push(part);
	}
	parts.push("</svg>");
	byteLength += encoder.encode("</svg>").byteLength;
	if (byteLength > MAX_SVG_BYTES)
		throw new DesignExportError("export-too-large");
	return parts.join("");
}

function decodeImage(source: string, timeoutMs = IMAGE_DECODE_TIMEOUT_MS) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		let settled = false;
		const finish = (callback: () => void) => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeout);
			image.onload = null;
			image.onerror = null;
			callback();
		};
		const timeout = window.setTimeout(() => {
			finish(() => {
				image.src = "";
				reject(new DesignExportError("image-decode-failed"));
			});
		}, timeoutMs);
		const resolveIfDecoded = () => {
			if (!image.naturalWidth || !image.naturalHeight) {
				finish(() => reject(new DesignExportError("image-decode-failed")));
				return;
			}
			finish(() => resolve(image));
		};
		const rejectDecode = (cause?: unknown) => {
			finish(() => reject(new DesignExportError("image-decode-failed", cause)));
		};
		image.onload = resolveIfDecoded;
		image.onerror = () => rejectDecode();
		image.src = source;
		if (typeof image.decode === "function") {
			try {
				image.decode().then(resolveIfDecoded, rejectDecode);
			} catch (cause) {
				rejectDecode(cause);
			}
		}
	});
}

async function validateUsedAssets(
	document: DesignDocument,
	assets: readonly ExportAsset[],
) {
	const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
	const usedAssetIds = new Set(
		document.elements.flatMap((element) =>
			element.type === "image" ? [element.assetId] : [],
		),
	);
	const deadline = Date.now() + ASSET_VALIDATION_TIMEOUT_MS;
	for (const id of usedAssetIds) {
		const asset = assetsById.get(id);
		if (!asset) throw new DesignExportError("missing-asset");
		const remainingMs = deadline - Date.now();
		if (remainingMs <= 0) throw new DesignExportError("image-decode-failed");
		let image: HTMLImageElement;
		try {
			image = await decodeImage(
				asset.dataUrl,
				Math.min(IMAGE_DECODE_TIMEOUT_MS, remainingMs),
			);
		} catch (cause) {
			if (
				cause instanceof DesignExportError &&
				cause.code === "image-decode-failed"
			) {
				throw new DesignExportError("invalid-asset", cause);
			}
			throw cause;
		}
		if (
			image.naturalWidth !== asset.width ||
			image.naturalHeight !== asset.height
		) {
			throw new DesignExportError("invalid-asset");
		}
	}
}

export function createSvgDataUrl(svg: string) {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType: string,
	quality?: number,
) {
	return new Promise<Blob>((resolve, reject) => {
		const timeout = window.setTimeout(
			() => reject(new DesignExportError("encode-failed")),
			ENCODE_TIMEOUT_MS,
		);
		try {
			canvas.toBlob(
				(blob) => {
					window.clearTimeout(timeout);
					if (!blob) {
						reject(new DesignExportError("encode-failed"));
						return;
					}
					if (blob.type !== mimeType) {
						reject(new DesignExportError("encode-failed"));
						return;
					}
					resolve(blob);
				},
				mimeType,
				quality,
			);
		} catch (cause) {
			window.clearTimeout(timeout);
			reject(
				cause instanceof DOMException && cause.name === "SecurityError"
					? cause
					: new DesignExportError("encode-failed", cause),
			);
		}
	});
}

async function waitForFonts(fonts: FontFaceSet | undefined) {
	if (!fonts?.ready) return;
	let timeout: number | undefined;
	try {
		await Promise.race([
			fonts.ready.catch(() => undefined),
			new Promise<void>((resolve) => {
				timeout = window.setTimeout(resolve, FONT_READY_TIMEOUT_MS);
			}),
		]);
	} finally {
		if (timeout !== undefined) window.clearTimeout(timeout);
	}
}

export async function createDesignExport(
	document: DesignDocument,
	assets: readonly ExportAsset[],
	options: DesignExportOptions,
): Promise<Blob> {
	options.onProgress?.("preparing");
	const svg = buildDesignExportSvg(document, assets);
	if (options.format === "svg") {
		if (typeof window !== "undefined" && typeof Image !== "undefined")
			await validateUsedAssets(document, assets);
		return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
	}
	if (typeof window === "undefined" || typeof Image === "undefined") {
		throw new DesignExportError("canvas-unavailable");
	}
	const pixels = document.width * document.height;
	if (pixels > MAX_EXPORT_PIXELS)
		throw new DesignExportError("export-too-large");
	await validateUsedAssets(document, assets);
	options.onProgress?.("rendering");
	try {
		await waitForFonts(window.document.fonts);
		const image = await decodeImage(createSvgDataUrl(svg));
		const canvas = window.document.createElement("canvas");
		canvas.width = document.width;
		canvas.height = document.height;
		const context = canvas.getContext("2d");
		if (!context) throw new DesignExportError("canvas-unavailable");
		if (options.format === "jpeg") {
			context.fillStyle = document.background;
			context.fillRect(0, 0, canvas.width, canvas.height);
		}
		context.drawImage(image, 0, 0);
		options.onProgress?.("encoding");
		const type = options.format === "jpeg" ? "image/jpeg" : "image/png";
		const blob = await canvasToBlob(
			canvas,
			type,
			options.format === "jpeg" ? (options.quality ?? 0.95) : undefined,
		);
		if (blob.size === 0) throw new DesignExportError("encode-failed");
		return blob;
	} catch (cause) {
		if (cause instanceof DesignExportError) throw cause;
		if (cause instanceof DOMException && cause.name === "SecurityError") {
			throw new DesignExportError("invalid-asset", cause);
		}
		throw new DesignExportError("image-decode-failed", cause);
	}
}

export function downloadDesignBlob(blob: Blob, filename: string) {
	if (
		typeof window === "undefined" ||
		typeof URL.createObjectURL !== "function"
	) {
		throw new DesignExportError("export-failed");
	}
	const safeName =
		Array.from(filename)
			.map((character) => {
				const code = character.codePointAt(0) ?? 0;
				return /[\\/:*?"<>|]/.test(character) || code < 32 || code === 127
					? "-"
					: character;
			})
			.join("")
			.slice(0, 120) || "printclub-export";
	const url = URL.createObjectURL(blob);
	const link = window.document.createElement("a");
	link.href = url;
	link.download = safeName;
	link.style.display = "none";
	window.document.body.append(link);
	try {
		link.click();
	} catch (cause) {
		URL.revokeObjectURL(url);
		link.remove();
		throw new DesignExportError("export-failed", cause);
	}
	link.remove();
	// Keep the object URL alive through the browser's asynchronous download handoff.
	window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
