import {
	type DesignDocument,
	type DesignElement,
	designDocumentSchema,
	getProduct,
} from "@PhotoPrinting/api/domain/print";

export type TemplateId = "blank" | "caption" | "gallery" | "celebration";
export type CreationStep = 1 | 2 | 3;
export const templateCompositionVersion = 1;

export type StoredAsset = {
	id: string;
	name: string;
	dataUrl: string;
	width: number;
	height: number;
};

export type CreationDraft = {
	version: 1;
	templateRevision?: number;
	id: string;
	productId: string;
	templateId: TemplateId;
	projectName: string;
	started: boolean;
	document: DesignDocument;
	assets: StoredAsset[];
	step: CreationStep;
	createdAt: string;
	updatedAt: string;
};

export const templateDefinitions = [
	{
		id: "caption",
		label: "Caption card",
		category: "Everyday",
		image: "/images/template-everyday.webp",
		description:
			"A full photo with a clean caption band for a date, place, or note.",
	},
	{
		id: "gallery",
		label: "Gallery label",
		category: "Travel",
		image: "/images/template-travel.webp",
		description:
			"A generous mat and gallery label for travel memories and places.",
	},
	{
		id: "celebration",
		label: "Night notes",
		category: "Celebrations",
		image: "/images/template-celebrations.webp",
		description:
			"An editorial crop with a small title block for an evening worth keeping.",
	},
] as const;

export const productImages: Record<string, string> = {
	"classic-print": "/images/printclub-hero.webp",
	"square-print": "/images/template-everyday.webp",
	"photo-strip": "/images/template-celebrations.webp",
	poster: "/images/template-travel.webp",
	"framed-print": "/images/template-framed.webp",
};

const databaseName = "printclub-creation";
const storeName = "drafts";
const currentDraftKey = "printclub:current-draft-id:v1";
const legacyDocumentKey = "printclub:guest-document:v1";
const legacyAssetsKey = "printclub:guest-assets:v1";
const legacyProjectNameKey = "printclub:guest-project-name:v1";

function openDraftDatabase(): Promise<IDBDatabase> {
	if (typeof indexedDB === "undefined") {
		return Promise.reject(new Error("IndexedDB is unavailable."));
	}
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(storeName)) {
				request.result.createObjectStore(storeName, { keyPath: "id" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("Could not open drafts."));
	});
}

function transactDraft(
	draft: CreationDraft,
	mode: IDBTransactionMode,
): Promise<void> {
	return openDraftDatabase().then(
		(database) =>
			new Promise((resolve, reject) => {
				const transaction = database.transaction(storeName, mode);
				transaction.objectStore(storeName).put(draft);
				transaction.oncomplete = () => {
					database.close();
					resolve();
				};
				transaction.onerror = () => {
					database.close();
					reject(transaction.error ?? new Error("Could not save draft."));
				};
			}),
	);
}

async function readDraft(id: string): Promise<CreationDraft | null> {
	try {
		const database = await openDraftDatabase();
		return await new Promise((resolve, reject) => {
			const request = database
				.transaction(storeName, "readonly")
				.objectStore(storeName)
				.get(id);
			request.onsuccess = () => {
				database.close();
				const value = request.result as unknown;
				if (!value || typeof value !== "object") return resolve(null);
				const parsed = value as CreationDraft;
				resolve(parsed.version === 1 ? parsed : null);
			};
			request.onerror = () => {
				database.close();
				reject(request.error ?? new Error("Could not read draft."));
			};
		});
	} catch {
		return null;
	}
}

export async function loadCreationDraft(
	id?: string,
): Promise<CreationDraft | null> {
	const draftId =
		id ?? window.localStorage.getItem(currentDraftKey) ?? undefined;
	if (!draftId) return migrateLegacyDraft();
	return (await readDraft(draftId)) ?? migrateLegacyDraft();
}

/** Return the last browser draft without making it the active setup draft. */
export async function findResumableCreationDraft(): Promise<CreationDraft | null> {
	const draftId = window.localStorage.getItem(currentDraftKey);
	if (draftId) {
		const draft = await getCreationDraft(draftId);
		if (draft) return draft;
	}
	return migrateLegacyDraft();
}

export async function saveCreationDraft(draft: CreationDraft): Promise<void> {
	const next = { ...draft, updatedAt: new Date().toISOString() };
	try {
		await transactDraft(next, "readwrite");
		window.localStorage.setItem(currentDraftKey, next.id);
	} catch {
		window.localStorage.setItem(currentDraftKey, next.id);
		window.localStorage.setItem(
			`printclub:draft-fallback:${next.id}`,
			JSON.stringify(next),
		);
	}
}

export async function getCreationDraft(
	id: string,
): Promise<CreationDraft | null> {
	const draft = await readDraft(id);
	if (draft) return draft;
	try {
		const fallback = JSON.parse(
			window.localStorage.getItem(`printclub:draft-fallback:${id}`) ?? "null",
		) as CreationDraft | null;
		return fallback?.version === 1 ? fallback : null;
	} catch {
		return null;
	}
}

export async function createCreationDraft(
	productId = "classic-10x15",
	templateId: TemplateId = "blank",
): Promise<CreationDraft> {
	const now = new Date().toISOString();
	const document = createDocument(productId, templateId);
	return {
		version: 1,
		templateRevision: templateCompositionVersion,
		id: crypto.randomUUID(),
		productId: document.productId,
		templateId,
		projectName: "Untitled memory",
		started: templateId !== "blank",
		document,
		assets: [],
		step: 1,
		createdAt: now,
		updatedAt: now,
	};
}

export function createDocument(
	productId = "classic-10x15",
	templateId: TemplateId = "blank",
): DesignDocument {
	const product = getProduct(productId) ?? getProduct("classic-10x15");
	if (!product)
		throw new Error("The catalog must include a classic print fallback.");
	const ratio = product.widthMm / product.heightMm;
	const width = ratio >= 1 ? 600 : Math.round(600 * ratio);
	const height = ratio >= 1 ? Math.round(600 / ratio) : 600;
	const document: DesignDocument = {
		schemaVersion: 1,
		id: "guest-design",
		productId: product.id,
		width,
		height,
		background: "#f7f0e5",
		elements: [],
		updatedAt: new Date().toISOString(),
	};
	return applyTemplateToDocument(document, templateId);
}

export function buildCreationDocument(
	productId: string,
	templateId: TemplateId,
	assets: StoredAsset[],
): DesignDocument {
	let document = createDocument(productId, "blank");
	const product = getProduct(productId);
	const visibleAssets =
		product?.kind === "photo-strip" ? assets.slice(0, 3) : assets.slice(0, 1);
	for (const [index, asset] of visibleAssets.entries()) {
		document = addAssetToDocument(document, asset, index);
	}
	return applyTemplateToDocument(document, templateId);
}

export function applyTemplateToDocument(
	document: DesignDocument,
	template: TemplateId,
): DesignDocument {
	const imageElements = document.elements.filter(
		(element) => element.type === "image",
	);
	if (template === "blank") {
		return {
			...document,
			elements: imageElements,
			updatedAt: new Date().toISOString(),
		};
	}
	const canReframePhoto = imageElements.length === 1;
	const positionedImages = canReframePhoto
		? imageElements.map((element) => {
				const frame =
					template === "caption"
						? {
								x: document.width * 0.08,
								y: document.height * 0.08,
								width: document.width * 0.84,
								height: document.height * 0.58,
							}
						: template === "gallery"
							? {
									x: document.width * 0.12,
									y: document.height * 0.13,
									width: document.width * 0.76,
									height: document.height * 0.58,
								}
							: {
									x: document.width * 0.1,
									y: document.height * 0.1,
									width: document.width * 0.8,
									height: document.height * 0.56,
								};
				return { ...element, ...frame };
			})
		: imageElements;
	const elements: DesignElement[] =
		template === "caption"
			? [
					{
						id: crypto.randomUUID(),
						type: "shape",
						shape: "rectangle",
						x: document.width * 0.06,
						y: document.height * 0.69,
						width: document.width * 0.88,
						height: document.height * 0.23,
						fill: "#f1e8da",
						rotation: 0,
					},
					{
						id: crypto.randomUUID(),
						type: "text",
						text: "EVERYDAY EDITION",
						x: document.width * 0.1,
						y: document.height * 0.75,
						fontSize: 13,
						color: "#3454d1",
						rotation: 0,
					},
					{
						id: crypto.randomUUID(),
						type: "text",
						text: "A moment worth keeping",
						x: document.width * 0.1,
						y: document.height * 0.82,
						fontSize: 24,
						color: "#2b211c",
						rotation: 0,
					},
				]
			: template === "gallery"
				? [
						{
							id: crypto.randomUUID(),
							type: "shape",
							shape: "rectangle",
							x: document.width * 0.07,
							y: document.height * 0.08,
							width: document.width * 0.86,
							height: document.height * 0.76,
							fill: "#e2d6c6",
							rotation: 0,
						},
						{
							id: crypto.randomUUID(),
							type: "text",
							text: "TRAVEL NOTES",
							x: document.width * 0.13,
							y: document.height * 0.77,
							fontSize: 13,
							color: "#3454d1",
							rotation: 0,
						},
						{
							id: crypto.randomUUID(),
							type: "text",
							text: "A quiet corner of the day",
							x: document.width * 0.13,
							y: document.height * 0.83,
							fontSize: 21,
							color: "#2b211c",
							rotation: 0,
						},
					]
				: [
						{
							id: crypto.randomUUID(),
							type: "shape",
							shape: "rectangle",
							x: document.width * 0.06,
							y: document.height * 0.68,
							width: document.width * 0.88,
							height: document.height * 0.25,
							fill: "#f0d8cf",
							rotation: 0,
						},
						{
							id: crypto.randomUUID(),
							type: "shape",
							shape: "circle",
							x: document.width * 0.7,
							y: document.height * 0.06,
							width: document.width * 0.22,
							height: document.width * 0.22,
							fill: "#d58256",
							rotation: 0,
						},
						{
							id: crypto.randomUUID(),
							type: "text",
							text: "NIGHT NOTES",
							x: document.width * 0.12,
							y: document.height * 0.75,
							fontSize: 13,
							color: "#3454d1",
							rotation: 0,
						},
						{
							id: crypto.randomUUID(),
							type: "text",
							text: "Keep the night going",
							x: document.width * 0.12,
							y: document.height * 0.82,
							fontSize: 23,
							color: "#2b211c",
							rotation: 0,
						},
					];
	const templateShapes = elements.filter((element) => element.type === "shape");
	const templateText = elements.filter((element) => element.type === "text");
	return {
		...document,
		background:
			template === "gallery"
				? "#f7f7f5"
				: template === "celebration"
					? "#fbefe9"
					: "#f7f0e5",
		elements: [...templateShapes, ...positionedImages, ...templateText],
		updatedAt: new Date().toISOString(),
	};
}

function templateElementSignature(element: DesignElement) {
	if (element.type === "image") return `image:${element.assetId}`;
	if (element.type === "text") return `text:${element.text}`;
	return `shape:${element.shape}:${element.fill}`;
}

/** Rebuild missing template layers from older drafts while preserving edited instances. */
export function repairTemplateDocument(
	document: DesignDocument,
	template: TemplateId,
	assets: StoredAsset[],
): DesignDocument {
	if (template === "blank") return document;
	const expected = buildCreationDocument(document.productId, template, assets);
	const used = new Set<string>();
	const restored = expected.elements.map((expectedElement) => {
		const signature = templateElementSignature(expectedElement);
		const existing = document.elements.find((element) => {
			if (used.has(element.id)) return false;
			return templateElementSignature(element) === signature;
		});
		if (existing) {
			used.add(existing.id);
			return existing;
		}
		return expectedElement;
	});
	const customElements = document.elements.filter(
		(element) => !used.has(element.id),
	);
	return {
		...document,
		elements: [...restored, ...customElements],
		updatedAt: new Date().toISOString(),
	};
}

export async function createAssetFromFile(file: File): Promise<StoredAsset> {
	if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
		throw new Error("Choose a JPEG, PNG, or WebP image.");
	}
	if (file.size > 8 * 1024 * 1024) {
		throw new Error("Images must be smaller than 8 MB in guest mode.");
	}
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error("This image could not be read."));
		reader.readAsDataURL(file);
	});
	const image = new Image();
	image.src = dataUrl;
	await new Promise<void>((resolve) => {
		image.onload = () => resolve();
		image.onerror = () => resolve();
	});
	if (!image.naturalWidth || !image.naturalHeight) {
		throw new Error("This image could not be decoded.");
	}
	return {
		id: crypto.randomUUID(),
		name: file.name,
		dataUrl,
		width: image.naturalWidth,
		height: image.naturalHeight,
	};
}

export function addAssetToDocument(
	document: DesignDocument,
	asset: StoredAsset,
	assetIndex = 0,
): DesignDocument {
	const product = getProduct(document.productId);
	const isStrip = product?.kind === "photo-strip";
	const frameWidth = isStrip
		? Math.max(70, (document.width * 0.76) / Math.min(3, assetIndex + 1))
		: Math.min(document.width - 56, 420);
	const frameHeight = isStrip
		? Math.min(
				document.height * 0.26,
				frameWidth * (asset.height / asset.width),
			)
		: Math.max(120, frameWidth * (asset.height / asset.width));
	const x = isStrip
		? document.width * 0.12 + assetIndex * (document.width * 0.25)
		: (document.width - frameWidth) / 2;
	const y = isStrip
		? document.height * 0.12 + assetIndex * document.height * 0.27
		: Math.max(24, (document.height - frameHeight) / 2);
	const element: DesignElement = {
		id: crypto.randomUUID(),
		type: "image",
		assetId: asset.id,
		x,
		y,
		width: frameWidth,
		height: frameHeight,
		rotation: 0,
		cropX: 0,
		cropY: 0,
		cropWidth: 1,
		cropHeight: 1,
	};
	return { ...document, elements: [...document.elements, element] };
}

export function readLegacyGuestDesign(): {
	document: DesignDocument;
	assets: StoredAsset[];
	projectName: string;
} | null {
	try {
		const savedDocument = JSON.parse(
			window.localStorage.getItem(legacyDocumentKey) ?? "null",
		);
		const savedAssets = JSON.parse(
			window.localStorage.getItem(legacyAssetsKey) ?? "[]",
		);
		const parsed = designDocumentSchema.safeParse(savedDocument);
		if (!parsed.success || !Array.isArray(savedAssets)) return null;
		return {
			document: parsed.data,
			assets: savedAssets as StoredAsset[],
			projectName:
				window.localStorage.getItem(legacyProjectNameKey) ?? "Untitled memory",
		};
	} catch {
		return null;
	}
}

async function migrateLegacyDraft(): Promise<CreationDraft | null> {
	const legacy = readLegacyGuestDesign();
	if (!legacy) return null;
	const now = new Date().toISOString();
	const draft: CreationDraft = {
		version: 1,
		templateRevision: templateCompositionVersion,
		id: crypto.randomUUID(),
		productId: legacy.document.productId,
		templateId: "blank",
		projectName: legacy.projectName,
		started: true,
		document: legacy.document,
		assets: legacy.assets,
		step: 3,
		createdAt: now,
		updatedAt: now,
	};
	await saveCreationDraft(draft);
	return draft;
}
