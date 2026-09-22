import {
	type DesignDocument,
	type DesignElement,
	getProduct,
} from "@PhotoPrinting/api/domain/print";
import { Button } from "@PhotoPrinting/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	CircleAlert,
	Copy,
	Download,
	ImagePlus,
	Link2,
	MoveDiagonal2,
	Redo2,
	RotateCw,
	Save,
	Send,
	Trash2,
	Type,
	Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import {
	addAssetToDocument,
	applyTemplateToDocument,
	buildCreationDocument,
	type CreationDraft,
	createAssetFromFile,
	createDocument,
	getCreationDraft,
	readLegacyGuestDesign,
	repairTemplateDocument,
	type StoredAsset,
	saveCreationDraft,
	type TemplateId,
	templateCompositionVersion,
} from "@/lib/creation-draft";
import { useTRPC } from "@/utils/trpc";

type DragState =
	| {
			mode: "move";
			id: string;
			startX: number;
			startY: number;
			originX: number;
			originY: number;
	  }
	| {
			mode: "resize";
			id: string;
			startX: number;
			startY: number;
			originX: number;
			originY: number;
			originWidth: number;
			originHeight: number;
			originFontSize?: number;
			handle: ResizeHandle;
	  }
	| {
			mode: "rotate";
			id: string;
			centerX: number;
			centerY: number;
			startAngle: number;
			originRotation: number;
	  };

type ResizeHandle = "nw" | "ne" | "sw" | "se";
type ShapeKind = Extract<DesignElement, { type: "shape" }>["shape"];
type TransformableElement = Extract<
	DesignElement,
	{ type: "image" | "shape" | "text" }
>;
type LayerPointerDrag = {
	id: string;
	pointerId: number;
	startX: number;
	startY: number;
	active: boolean;
};

function getLayerLabel(element: DesignElement, assetName?: string) {
	if (element.type === "image") {
		return assetName ? `Photo · ${assetName}` : "Photo";
	}
	if (element.type === "text") return `Text · ${element.text}`;
	return element.shape[0].toUpperCase() + element.shape.slice(1);
}

function getElementBounds(element: TransformableElement, canvasWidth: number) {
	if (element.type === "text") {
		return {
			x: element.x,
			y: element.y,
			width: element.width ?? canvasWidth * 0.8,
			height: element.height ?? Math.max(32, element.fontSize * 1.3),
		};
	}
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
	};
}

export function StudioEditor({ draftId }: { draftId?: string } = {}) {
	const trpc = useTRPC();
	const submitOrder = useMutation(trpc.submitDemoOrder.mutationOptions());
	const { data: session } = authClient.useSession();
	const [document, setDocument] = useState<DesignDocument>(() =>
		createDocument(),
	);
	const [assets, setAssets] = useState<StoredAsset[]>([]);
	const [history, setHistory] = useState<DesignDocument[]>(() => [
		createDocument(),
	]);
	const [historyIndex, setHistoryIndex] = useState(0);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [zoom, setZoom] = useState(0.9);
	const [status, setStatus] = useState("Unsaved guest design");
	const [projectName, setProjectName] = useState("Untitled memory");
	const [draftIdState, setDraftIdState] = useState(draftId);
	const [draftTemplateId, setDraftTemplateId] = useState<TemplateId>("blank");
	const [textDraft, setTextDraft] = useState("A moment worth keeping");
	const [contactName, setContactName] = useState("");
	const [contactEmail, setContactEmail] = useState("");
	const [quantity, setQuantity] = useState(1);
	const [requestError, setRequestError] = useState<string | null>(null);
	const requestErrorRef = useRef<HTMLParagraphElement>(null);
	const [activePanel, setActivePanel] = useState<
		"templates" | "photos" | "text" | "shapes" | "layers"
	>("templates");
	const [panelOpen, setPanelOpen] = useState(false);
	const [panelDismissed, setPanelDismissed] = useState(false);
	const [requestOpen, setRequestOpen] = useState(false);
	const [authPrompt, setAuthPrompt] = useState<"review" | "export" | null>(
		null,
	);
	const [exportOpen, setExportOpen] = useState(false);
	const [exportBusy, setExportBusy] = useState(false);
	const [orientationDismissed, setOrientationDismissed] = useState(false);
	const [layerDragId, setLayerDragId] = useState<string | null>(null);
	const [layerDropId, setLayerDropId] = useState<string | null>(null);
	const [layerDropSide, setLayerDropSide] = useState<"before" | "after">(
		"before",
	);
	const [layerDragPosition, setLayerDragPosition] = useState({ x: 0, y: 0 });
	const fileRef = useRef<HTMLInputElement>(null);
	const dragRef = useRef<DragState | null>(null);
	const layerPointerRef = useRef<LayerPointerDrag | null>(null);
	const suppressLayerClickRef = useRef(false);
	const documentRef = useRef(document);
	const savedStateRef = useRef<string | null>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	const exportMenuRef = useRef<HTMLDivElement>(null);
	const toolButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

	const selectedElement = useMemo(
		() => document.elements.find((element) => element.id === selectedId),
		[document.elements, selectedId],
	);
	const draggedLayer = layerDragId
		? document.elements.find((element) => element.id === layerDragId)
		: null;
	const selectedBounds = selectedElement
		? getElementBounds(selectedElement, document.width)
		: null;
	const isDirty =
		savedStateRef.current !== null &&
		savedStateRef.current !==
			JSON.stringify({
				document,
				projectName: projectName.trim() || "Untitled memory",
			});
	const undo = useCallback(() => {
		if (historyIndex <= 0) return;
		const nextIndex = historyIndex - 1;
		const previous = history[nextIndex];
		if (!previous) return;
		setHistoryIndex(nextIndex);
		setDocument(previous);
		setStatus("Undo applied");
	}, [history, historyIndex]);
	const redo = useCallback(() => {
		if (historyIndex >= history.length - 1) return;
		const nextIndex = historyIndex + 1;
		const next = history[nextIndex];
		if (!next) return;
		setHistoryIndex(nextIndex);
		setDocument(next);
		setStatus("Redo applied");
	}, [history, historyIndex]);

	useEffect(() => {
		let cancelled = false;
		async function hydrate() {
			const prepared = draftId ? await getCreationDraft(draftId) : null;
			const legacy = prepared ? null : readLegacyGuestDesign();
			if (cancelled) return;
			if (prepared) {
				const needsImageRepair =
					prepared.assets.length > 0 &&
					!prepared.document.elements.some(
						(element) => element.type === "image",
					);
				const imageRepairedDocument = needsImageRepair
					? buildCreationDocument(
							prepared.productId,
							prepared.templateId,
							prepared.assets,
						)
					: prepared.document;
				const needsTemplateRepair =
					prepared.templateId !== "blank" &&
					prepared.templateRevision !== templateCompositionVersion;
				const preparedDocument = needsTemplateRepair
					? repairTemplateDocument(
							imageRepairedDocument,
							prepared.templateId,
							prepared.assets,
						)
					: imageRepairedDocument;
				if (needsImageRepair || needsTemplateRepair) {
					await saveCreationDraft({
						...prepared,
						templateRevision: templateCompositionVersion,
						document: preparedDocument,
					});
				}
				setDraftIdState(prepared.id);
				setDraftTemplateId(prepared.templateId);
				setDocument(preparedDocument);
				setHistory([preparedDocument]);
				setAssets(prepared.assets);
				setProjectName(prepared.projectName);
				savedStateRef.current = JSON.stringify({
					document: preparedDocument,
					projectName: prepared.projectName,
				});
				setStatus("Prepared design loaded · save when ready");
				return;
			}
			if (legacy) {
				setDocument(legacy.document);
				setHistory([legacy.document]);
				setAssets(legacy.assets);
				setProjectName(legacy.projectName);
				savedStateRef.current = JSON.stringify({
					document: legacy.document,
					projectName: legacy.projectName,
				});
				setStatus("Recovered guest design");
				return;
			}
			setStatus("Guest mode · save when ready");
		}
		void hydrate();
		return () => {
			cancelled = true;
		};
	}, [draftId]);
	useEffect(() => {
		documentRef.current = document;
	}, [document]);
	useEffect(() => {
		if (!session) return;
		const params = new URLSearchParams(window.location.search);
		const authAction = params.get("auth");
		if (authAction === "review") setRequestOpen(true);
		if (authAction === "export") setExportOpen(true);
		if (authAction) {
			params.delete("auth");
			const query = params.toString();
			window.history.replaceState(
				{},
				"",
				`${window.location.pathname}${query ? `?${query}` : ""}`,
			);
		}
	}, [session]);
	useEffect(() => {
		if (!exportOpen) return;
		function closeExportMenu(event: MouseEvent) {
			if (!exportMenuRef.current?.contains(event.target as Node)) {
				setExportOpen(false);
			}
		}
		function closeExportMenuOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape") setExportOpen(false);
		}
		window.document.addEventListener("pointerdown", closeExportMenu);
		window.document.addEventListener("keydown", closeExportMenuOnEscape);
		return () => {
			window.document.removeEventListener("pointerdown", closeExportMenu);
			window.document.removeEventListener("keydown", closeExportMenuOnEscape);
		};
	}, [exportOpen]);
	useEffect(() => {
		function handleHistoryShortcut(event: KeyboardEvent) {
			if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
			if (event.key.toLowerCase() !== "z") return;
			const target = event.target as HTMLElement | null;
			if (
				target?.closest("input, textarea, select, [contenteditable='true']")
			) {
				return;
			}
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		}
		window.document.addEventListener("keydown", handleHistoryShortcut);
		return () =>
			window.document.removeEventListener("keydown", handleHistoryShortcut);
	}, [redo, undo]);

	function commit(nextDocument: DesignDocument, message = "Unsaved changes") {
		const next = { ...nextDocument, updatedAt: new Date().toISOString() };
		setDocument(next);
		setHistory((current) =>
			[...current.slice(0, historyIndex + 1), next].slice(-40),
		);
		setHistoryIndex((current) => Math.min(current + 1, 39));
		setStatus(message);
	}

	function addText() {
		const text = textDraft.trim();
		if (!text) return;
		const element: DesignElement = {
			id: crypto.randomUUID(),
			type: "text",
			text,
			x: document.width * 0.1,
			y: document.height / 2,
			width: document.width * 0.8,
			height: 42,
			fontSize: 32,
			color: "#2b211c",
			rotation: 0,
		};
		commit({ ...document, elements: [...document.elements, element] });
		setSelectedId(element.id);
	}

	function addShape(shape: ShapeKind) {
		const isLine = shape === "line";
		const element: DesignElement = {
			id: crypto.randomUUID(),
			type: "shape",
			shape,
			x: document.width / 2 - (isLine ? 110 : 90),
			y: document.height / 2 - (isLine ? 8 : 55),
			width: isLine ? 220 : 180,
			height: isLine ? 16 : 110,
			fill:
				shape === "circle" || shape === "blob"
					? "#d58256"
					: shape === "star"
						? "#3454d1"
						: shape === "line"
							? "#2b211c"
							: "#e3b86a",
			rotation: 0,
		};
		commit({ ...document, elements: [...document.elements, element] });
		setSelectedId(element.id);
	}

	function applyTemplate(template: "caption" | "gallery" | "celebration") {
		const nextDocument = applyTemplateToDocument(document, template);
		commit(nextDocument);
		setSelectedId(nextDocument.elements.at(-1)?.id ?? null);
		setDraftTemplateId(template);
		setStatus(
			`${template === "caption" ? "Caption" : template === "gallery" ? "Gallery" : "Celebration"} template applied`,
		);
	}

	async function addPhoto(file: File | undefined) {
		if (!file) return;
		try {
			const asset = await createAssetFromFile(file);
			const nextAssets = [...assets, asset];
			const nextDocument = addAssetToDocument(
				document,
				asset,
				nextAssets.length - 1,
			);
			setAssets(nextAssets);
			commit(nextDocument);
			setSelectedId(nextDocument.elements.at(-1)?.id ?? null);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "This photo could not be added.",
			);
		}
	}

	async function saveGuest(): Promise<CreationDraft> {
		const now = new Date().toISOString();
		const savedDraft: CreationDraft = {
			version: 1,
			templateRevision: templateCompositionVersion,
			id: draftIdState ?? crypto.randomUUID(),
			productId: document.productId,
			templateId: draftTemplateId,
			projectName: projectName.trim() || "Untitled memory",
			started: true,
			document,
			assets,
			step: 3,
			createdAt: now,
			updatedAt: now,
		};
		setDraftIdState(savedDraft.id);
		window.localStorage.setItem(
			"printclub:guest-document:v1",
			JSON.stringify(document),
		);
		window.localStorage.setItem(
			"printclub:guest-assets:v1",
			JSON.stringify(assets),
		);
		window.localStorage.setItem(
			"printclub:guest-project-name:v1",
			savedDraft.projectName,
		);
		await saveCreationDraft(savedDraft);
		savedStateRef.current = JSON.stringify({
			document,
			projectName: savedDraft.projectName,
		});
		setStatus("Saved in this browser");
		return savedDraft;
	}

	function duplicateDesign() {
		const nextDocument = {
			...document,
			id: crypto.randomUUID(),
			updatedAt: new Date().toISOString(),
		};
		setDocument(nextDocument);
		setHistory([nextDocument]);
		setHistoryIndex(0);
		setDraftIdState(crypto.randomUUID());
		setProjectName(`${projectName.trim() || "Untitled memory"} copy`);
		setStatus("Duplicated guest design");
	}

	function removeSelected() {
		if (!selectedId) return;
		commit({
			...document,
			elements: document.elements.filter(
				(element) => element.id !== selectedId,
			),
		});
		setSelectedId(null);
	}

	function redirectToAuth(action: "review" | "export") {
		const params = new URLSearchParams(window.location.search);
		params.set("auth", action);
		const query = params.toString();
		const returnTo = `${window.location.pathname}${query ? `?${query}` : ""}`;
		window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
	}

	function buildExportSvg() {
		const escapeXml = (value: string) =>
			value.replace(
				/[<>&'"]/g,
				(character) =>
					({
						"<": "&lt;",
						">": "&gt;",
						"&": "&amp;",
						"'": "&apos;",
						'"': "&quot;",
					})[character] ?? character,
			);
		const content = document.elements
			.map((element) => {
				if (element.type === "text") {
					const rotation = element.rotation
						? ` transform="rotate(${element.rotation} ${element.x} ${element.y})"`
						: "";
					return `<text x="${element.x}" y="${element.y}" font-family="Inter, sans-serif" font-size="${element.fontSize}" fill="${escapeXml(element.color)}"${rotation}>${escapeXml(element.text)}</text>`;
				}
				if (element.type === "shape") {
					const fill = escapeXml(element.fill);
					const x = element.x;
					const y = element.y;
					const width = element.width;
					const height = element.height;
					const rotation = element.rotation
						? ` transform="rotate(${element.rotation} ${x + width / 2} ${y + height / 2})"`
						: "";
					if (element.shape === "circle" || element.shape === "blob")
						return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${fill}"${rotation} />`;
					if (element.shape === "triangle")
						return `<polygon points="${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}" fill="${fill}"${rotation} />`;
					if (element.shape === "star") {
						const points = Array.from({ length: 10 }, (_, index) => {
							const angle = -Math.PI / 2 + (index * Math.PI) / 5;
							const radius = index % 2 === 0 ? 0.5 : 0.22;
							return `${x + width / 2 + Math.cos(angle) * width * radius},${y + height / 2 + Math.sin(angle) * height * radius}`;
						}).join(" ");
						return `<polygon points="${points}" fill="${fill}"${rotation} />`;
					}
					return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${element.shape === "line" ? height / 2 : 0}" fill="${fill}"${rotation} />`;
				}
				const asset = assets.find((item) => item.id === element.assetId);
				return asset
					? `<image href="${asset.dataUrl}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" preserveAspectRatio="xMidYMid slice"${element.rotation ? ` transform="rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})"` : ""} />`
					: "";
			})
			.join("");
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}"><rect width="100%" height="100%" fill="${document.background}" />${content}</svg>`;
	}

	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const link = window.document.createElement("a");
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function exportDesign(format: "png" | "jpeg" | "svg") {
		if (!session) {
			setAuthPrompt("export");
			return;
		}
		setExportBusy(true);
		setExportOpen(false);
		try {
			const svg = buildExportSvg();
			if (format === "svg") {
				downloadBlob(
					new Blob([svg], { type: "image/svg+xml" }),
					`${document.productId}-preview.svg`,
				);
				setStatus("SVG preview downloaded");
				return;
			}
			const imageUrl = URL.createObjectURL(
				new Blob([svg], { type: "image/svg+xml" }),
			);
			const image = new Image();
			image.decoding = "async";
			image.src = imageUrl;
			await image.decode();
			URL.revokeObjectURL(imageUrl);
			const canvas = window.document.createElement("canvas");
			canvas.width = document.width;
			canvas.height = document.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas export is unavailable");
			if (format === "jpeg") {
				context.fillStyle = document.background;
				context.fillRect(0, 0, canvas.width, canvas.height);
			}
			context.drawImage(image, 0, 0);
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, `image/${format}`, 0.95),
			);
			if (!blob) throw new Error("Image export failed");
			downloadBlob(blob, `${document.productId}-preview.${format}`);
			setStatus(`${format.toUpperCase()} preview downloaded`);
		} catch {
			setStatus("Export failed. Try the preview again.");
		} finally {
			setExportBusy(false);
		}
	}

	async function copyProjectLink() {
		if (!session) {
			setAuthPrompt("export");
			return;
		}
		setExportBusy(true);
		setExportOpen(false);
		try {
			const savedDraft = draftIdState ? null : await saveGuest();
			const id = savedDraft?.id ?? draftIdState;
			if (!id) throw new Error("Design has not been saved");
			const url = `${window.location.origin}/studio?draft=${encodeURIComponent(id)}`;
			await navigator.clipboard.writeText(url);
			setStatus("Copied a browser-local project link");
		} catch {
			setStatus("Could not copy the project link");
		} finally {
			setExportBusy(false);
		}
	}

	function openRequestReview() {
		if (!session) {
			setAuthPrompt("review");
			return;
		}
		setRequestError(null);
		setRequestOpen(true);
	}

	async function requestOrder(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!session) {
			setRequestOpen(false);
			setAuthPrompt("review");
			return;
		}
		if (!contactName.trim() || !contactEmail.includes("@")) {
			setRequestError("Add your name and a valid email to send the request.");
			window.requestAnimationFrame(() => requestErrorRef.current?.focus());
			return;
		}
		setRequestError(null);
		try {
			const result = await submitOrder.mutateAsync({
				designId: document.id,
				productId: document.productId,
				quantity,
				contactName,
				contactEmail,
				notes: "Created in the guest studio",
			});
			const orders = JSON.parse(
				localStorage.getItem("printclub:demo-orders") ?? "[]",
			) as unknown[];
			localStorage.setItem(
				"printclub:demo-orders",
				JSON.stringify([
					...orders,
					{
						id: result.orderId,
						designId: document.id,
						productId: document.productId,
						quantity,
						contactName,
						contactEmail,
						createdAt: new Date().toISOString(),
					},
				]),
			);
			setStatus(`${result.message} Reference ${result.orderId}.`);
			setRequestOpen(false);
		} catch {
			const order = {
				id: `offline-${Date.now()}`,
				designId: document.id,
				productId: document.productId,
				quantity,
				contactName,
				contactEmail,
				createdAt: new Date().toISOString(),
			};
			const orders = JSON.parse(
				localStorage.getItem("printclub:demo-orders") ?? "[]",
			) as unknown[];
			localStorage.setItem(
				"printclub:demo-orders",
				JSON.stringify([...orders, order]),
			);
			setStatus(
				"Saved as a local demo request. Start the API to send it to the studio queue.",
			);
			setRequestOpen(false);
		}
	}

	function selectTool(tool: typeof activePanel) {
		setActivePanel(tool);
		setPanelOpen(true);
		setPanelDismissed(false);
	}

	function reorderLayers(
		sourceId: string,
		targetId: string,
		placement: "before" | "after",
	) {
		if (sourceId === targetId) return;
		const displayed = [...document.elements].reverse();
		const sourceIndex = displayed.findIndex(
			(element) => element.id === sourceId,
		);
		const targetIndex = displayed.findIndex(
			(element) => element.id === targetId,
		);
		if (sourceIndex < 0 || targetIndex < 0) return;
		const [source] = displayed.splice(sourceIndex, 1);
		if (!source) return;
		const nextTargetIndex = displayed.findIndex(
			(element) => element.id === targetId,
		);
		if (nextTargetIndex < 0) return;
		displayed.splice(
			placement === "after" ? nextTargetIndex + 1 : nextTargetIndex,
			0,
			source,
		);
		commit({ ...document, elements: displayed.reverse() }, "Layers reordered");
		setSelectedId(sourceId);
	}

	function getLayerDrop(clientX: number, clientY: number) {
		let target = window.document
			.elementFromPoint(clientX, clientY)
			?.closest<HTMLElement>("[data-layer-id]");
		if (!target) {
			const rows = Array.from(
				window.document.querySelectorAll<HTMLElement>("[data-layer-id]"),
			);
			target = rows.reduce<HTMLElement | null>((closest, row) => {
				const rect = row.getBoundingClientRect();
				if (clientX < rect.left || clientX > rect.right) return closest;
				if (!closest) return row;
				const closestRect = closest.getBoundingClientRect();
				return Math.abs(clientY - (rect.top + rect.height / 2)) <
					Math.abs(clientY - (closestRect.top + closestRect.height / 2))
					? row
					: closest;
			}, null);
		}
		if (!target?.dataset.layerId) return null;
		const rect = target.getBoundingClientRect();
		return {
			id: target.dataset.layerId,
			side:
				clientY < rect.top + rect.height / 2
					? ("before" as const)
					: ("after" as const),
		};
	}

	function beginLayerPointerDrag(
		event: React.PointerEvent<HTMLButtonElement>,
		id: string,
	) {
		if (event.button !== 0) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		layerPointerRef.current = {
			id,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			active: false,
		};
		setLayerDragPosition({ x: event.clientX, y: event.clientY });
	}

	function moveLayerPointerDrag(event: React.PointerEvent<HTMLButtonElement>) {
		const drag = layerPointerRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const distance = Math.hypot(
			event.clientX - drag.startX,
			event.clientY - drag.startY,
		);
		if (!drag.active && distance < 5) return;
		if (!drag.active) {
			drag.active = true;
			setLayerDragId(drag.id);
		}
		setLayerDragPosition({ x: event.clientX, y: event.clientY });
		const drop = getLayerDrop(event.clientX, event.clientY);
		const isValidDrop = drop && drop.id !== drag.id;
		setLayerDropId(isValidDrop ? drop.id : null);
		setLayerDropSide(isValidDrop ? drop.side : "before");
	}

	function endLayerPointerDrag(event: React.PointerEvent<HTMLButtonElement>) {
		const drag = layerPointerRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (drag.active) {
			const drop = getLayerDrop(event.clientX, event.clientY);
			if (drop && drop.id !== drag.id) {
				reorderLayers(drag.id, drop.id, drop.side);
			}
			suppressLayerClickRef.current = true;
			window.setTimeout(() => {
				suppressLayerClickRef.current = false;
			}, 0);
		}
		layerPointerRef.current = null;
		setLayerDragId(null);
		setLayerDropId(null);
		setLayerDropSide("before");
		setLayerDragPosition({ x: 0, y: 0 });
	}

	function selectLayer(id: string) {
		if (suppressLayerClickRef.current) {
			suppressLayerClickRef.current = false;
			return;
		}
		setSelectedId(id);
	}

	function beginDrag(event: React.PointerEvent, element: DesignElement) {
		event.currentTarget.setPointerCapture(event.pointerId);
		setSelectedId(element.id);
		dragRef.current = {
			mode: "move",
			id: element.id,
			startX: event.clientX,
			startY: event.clientY,
			originX: element.x,
			originY: element.y,
		};
	}

	function beginResize(
		event: React.PointerEvent<HTMLButtonElement>,
		element: TransformableElement,
		handle: ResizeHandle,
	) {
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		setSelectedId(element.id);
		const bounds = getElementBounds(element, document.width);
		dragRef.current = {
			mode: "resize",
			id: element.id,
			startX: event.clientX,
			startY: event.clientY,
			originX: bounds.x,
			originY: bounds.y,
			originWidth: bounds.width,
			originHeight: bounds.height,
			originFontSize: element.type === "text" ? element.fontSize : undefined,
			handle,
		};
	}

	function beginRotate(
		event: React.PointerEvent<HTMLButtonElement>,
		element: TransformableElement,
	) {
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		const canvas = canvasRef.current?.getBoundingClientRect();
		if (!canvas) return;
		const bounds = getElementBounds(element, document.width);
		const centerX = canvas.left + (bounds.x + bounds.width / 2) * zoom;
		const centerY = canvas.top + (bounds.y + bounds.height / 2) * zoom;
		dragRef.current = {
			mode: "rotate",
			id: element.id,
			centerX,
			centerY,
			startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
			originRotation: element.rotation,
		};
		setSelectedId(element.id);
	}

	function moveDrag(event: React.PointerEvent) {
		const drag = dragRef.current;
		if (!drag) return;
		const dx =
			(event.clientX - ("startX" in drag ? drag.startX : event.clientX)) / zoom;
		const dy =
			(event.clientY - ("startY" in drag ? drag.startY : event.clientY)) / zoom;
		setDocument((current) => ({
			...current,
			elements: current.elements.map((element) => {
				if (element.id !== drag.id) return element;
				if (drag.mode === "move")
					return {
						...element,
						x: drag.originX + dx,
						y: drag.originY + dy,
					} as DesignElement;
				if (drag.mode === "rotate") {
					const angle = Math.atan2(
						event.clientY - drag.centerY,
						event.clientX - drag.centerX,
					);
					return {
						...element,
						rotation:
							drag.originRotation + ((angle - drag.startAngle) * 180) / Math.PI,
					} as DesignElement;
				}
				let x = drag.originX;
				let y = drag.originY;
				let width = drag.originWidth;
				let height = drag.originHeight;
				if (drag.handle.includes("w")) {
					x += dx;
					width -= dx;
				} else if (drag.handle.includes("e")) width += dx;
				if (drag.handle.includes("n")) {
					y += dy;
					height -= dy;
				} else if (drag.handle.includes("s")) height += dy;
				const minimum = 32;
				if (width < minimum) {
					if (drag.handle.includes("w"))
						x = drag.originX + drag.originWidth - minimum;
					width = minimum;
				}
				if (height < minimum) {
					if (drag.handle.includes("n"))
						y = drag.originY + drag.originHeight - minimum;
					height = minimum;
				}
				if (element.type === "text") {
					const scale = Math.max(
						0.25,
						Math.max(width / drag.originWidth, height / drag.originHeight),
					);
					return {
						...element,
						x,
						y,
						width,
						height,
						fontSize: Math.min(
							400,
							Math.max(8, (drag.originFontSize ?? element.fontSize) * scale),
						),
					} as DesignElement;
				}
				return { ...element, x, y, width, height } as DesignElement;
			}),
		}));
	}

	function endDrag() {
		if (!dragRef.current) return;
		dragRef.current = null;
		commit(documentRef.current);
	}

	function moveSelectedWithKeyboard(event: React.KeyboardEvent) {
		if (!selectedId) return;
		const deltas: Record<string, [number, number]> = {
			ArrowLeft: [-5, 0],
			ArrowRight: [5, 0],
			ArrowUp: [0, -5],
			ArrowDown: [0, 5],
		};
		const delta = deltas[event.key];
		if (!delta) return;
		event.preventDefault();
		const element = document.elements.find((item) => item.id === selectedId);
		if (element)
			updateSelected({ x: element.x + delta[0], y: element.y + delta[1] });
	}

	function updateSelected(
		update: Partial<Extract<DesignElement, { id: string }>>,
	) {
		if (!selectedId) return;
		commit({
			...document,
			elements: document.elements.map((element) =>
				element.id === selectedId
					? ({ ...element, ...update } as DesignElement)
					: element,
			),
		});
	}

	function leaveForSetup(event: React.MouseEvent<HTMLAnchorElement>) {
		if (!isDirty) return;
		if (
			!window.confirm(
				"Leave the editor? Save first if you want to keep your latest changes.",
			)
		) {
			event.preventDefault();
		}
	}

	return (
		<div className="studio-app">
			<header className="studio-app__topbar">
				<nav className="studio-app__navigation" aria-label="Editor navigation">
					<a
						className="studio-app__back studio-app__back--home"
						href="/"
						onClick={leaveForSetup}
					>
						<ArrowLeft aria-hidden="true" /> Back to printclub
					</a>
					<a
						className="studio-app__back studio-app__back--setup"
						href={
							draftIdState
								? `/create?draft=${draftIdState}&step=3`
								: "/create?resume=true"
						}
						onClick={leaveForSetup}
					>
						<ArrowLeft aria-hidden="true" />
						Back to setup
					</a>
				</nav>
				<div className="studio-app__project">
					<span className="studio-app__eyebrow">
						{session ? "Member studio" : "Guest studio"}
					</span>
					<label>
						<span className="sr-only">Project name</span>
						<input
							value={projectName}
							onChange={(event) => {
								setProjectName(event.target.value);
								setStatus("Unsaved changes");
							}}
							aria-label="Project name"
						/>
					</label>
				</div>
				<div className="studio-app__actions">
					<span className="studio-save-status" role="status" aria-live="polite">
						<span
							className={
								submitOrder.isPending
									? "status-dot status-dot--busy"
									: "status-dot"
							}
						/>
						{status}
					</span>
					<fieldset className="studio-history-controls">
						<legend className="sr-only">History</legend>
						<button
							className="studio-icon-button studio-icon-button--quiet"
							type="button"
							onClick={undo}
							disabled={historyIndex === 0}
							aria-label="Undo"
							aria-keyshortcuts="Control+Z Meta+Z"
							title="Undo (Ctrl/Cmd+Z)"
						>
							<Undo2 aria-hidden="true" />
						</button>
						<button
							className="studio-icon-button studio-icon-button--quiet"
							type="button"
							onClick={redo}
							disabled={historyIndex === history.length - 1}
							aria-label="Redo"
							aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
							title="Redo (Ctrl/Cmd+Shift+Z)"
						>
							<Redo2 aria-hidden="true" />
						</button>
					</fieldset>
					<Button
						className="studio-action-button"
						variant="outline"
						onClick={duplicateDesign}
					>
						<Copy data-icon="inline-start" aria-hidden="true" /> Duplicate
					</Button>
					<Button
						className="studio-action-button"
						variant="outline"
						onClick={() => void saveGuest()}
					>
						<Save data-icon="inline-start" aria-hidden="true" /> Save
					</Button>
					<div className="studio-export-menu" ref={exportMenuRef}>
						<Button
							className="studio-action-button studio-action-button--primary"
							onClick={() => {
								if (!session) {
									setAuthPrompt("export");
									return;
								}
								setExportOpen((open) => !open);
							}}
							aria-haspopup="menu"
							aria-expanded={exportOpen}
							disabled={exportBusy}
						>
							<Download data-icon="inline-start" aria-hidden="true" />
							Export preview
						</Button>
						{exportOpen && session ? (
							<div className="studio-export-menu__panel" role="menu">
								<strong>Export your design</strong>
								<button
									type="button"
									role="menuitem"
									onClick={() => void exportDesign("png")}
								>
									<Download aria-hidden="true" /> PNG image
								</button>
								<button
									type="button"
									role="menuitem"
									onClick={() => void exportDesign("jpeg")}
								>
									<Download aria-hidden="true" /> JPEG image
								</button>
								<button
									type="button"
									role="menuitem"
									onClick={() => void exportDesign("svg")}
								>
									<Download aria-hidden="true" /> SVG preview
								</button>
								<button
									type="button"
									role="menuitem"
									onClick={() => void copyProjectLink()}
								>
									<Link2 aria-hidden="true" /> Copy browser link
								</button>
								<small>
									Links work on this browser until cloud sharing is added.
								</small>
							</div>
						) : null}
					</div>
					<Button
						className="studio-action-button"
						variant="outline"
						onClick={openRequestReview}
					>
						<Send data-icon="inline-start" aria-hidden="true" />
						Request review
					</Button>
				</div>
			</header>
			<div
				className={[
					"studio-app__body",
					panelDismissed ? "studio-app__body--panel-closed" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<nav className="studio-toolrail" aria-label="Studio tools">
					{(
						[
							["templates", "Templates"],
							["photos", "Photos"],
							["text", "Text"],
							["shapes", "Shapes"],
							["layers", "Layers"],
						] as const
					).map(([tool, label]) => (
						<button
							type="button"
							className={activePanel === tool ? "is-active" : ""}
							aria-current={activePanel === tool ? "page" : undefined}
							ref={(element) => {
								toolButtonRefs.current[tool] = element;
							}}
							onClick={() => selectTool(tool)}
							key={tool}
						>
							<span className="studio-toolrail__icon" aria-hidden="true">
								{tool === "templates"
									? "✦"
									: tool === "photos"
										? "◈"
										: tool === "text"
											? "T"
											: tool === "shapes"
												? "◇"
												: "≡"}
							</span>
							{label}
						</button>
					))}
				</nav>
				<aside
					className={[
						"studio-toolpanel",
						panelDismissed ? "is-closed" : "",
						panelOpen ? "is-open" : "",
					]
						.filter(Boolean)
						.join(" ")}
					aria-label="Studio tools panel"
				>
					<div className="studio-toolpanel__heading">
						<div>
							<span className="studio-app__eyebrow">Tools</span>
							<h2>{activePanel[0].toUpperCase() + activePanel.slice(1)}</h2>
						</div>
						<button
							className="studio-icon-button studio-icon-button--quiet"
							type="button"
							aria-label="Close tools panel"
							onClick={() => {
								setPanelOpen(false);
								setPanelDismissed(true);
								window.requestAnimationFrame(() => {
									toolButtonRefs.current[activePanel]?.focus();
								});
							}}
						>
							×
						</button>
					</div>
					{activePanel === "templates" ? (
						<div className="studio-toolpanel__content">
							<p className="studio-panel-copy">
								Choose a print-ready composition. Your photo and every layer
								stay editable.
							</p>
							<div className="studio-template-grid studio-template-grid--v2">
								<button type="button" onClick={() => applyTemplate("caption")}>
									<span
										className="studio-template studio-template--caption"
										aria-hidden="true"
									/>
									<span>Caption card</span>
									<small>Photo + caption band</small>
								</button>
								<button type="button" onClick={() => applyTemplate("gallery")}>
									<span
										className="studio-template studio-template--gallery"
										aria-hidden="true"
									/>
									<span>Gallery label</span>
									<small>Mat + place label</small>
								</button>
								<button
									type="button"
									onClick={() => applyTemplate("celebration")}
								>
									<span
										className="studio-template studio-template--celebration"
										aria-hidden="true"
									/>
									<span>Night notes</span>
									<small>Photo + title block</small>
								</button>
							</div>
						</div>
					) : null}
					{activePanel === "photos" ? (
						<div className="studio-toolpanel__content">
							<label className="studio-upload">
								<ImagePlus aria-hidden="true" />
								<span>Upload a photo</span>
								<small>JPEG, PNG, or WebP · 8 MB max</small>
								<input
									ref={fileRef}
									type="file"
									accept="image/jpeg,image/png,image/webp"
									onChange={(event) => {
										void addPhoto(event.target.files?.[0]);
										event.currentTarget.value = "";
									}}
								/>
							</label>
							<p className="studio-panel-copy">
								Your original file stays in this browser for this demo.
							</p>
						</div>
					) : null}
					{activePanel === "text" ? (
						<div className="studio-toolpanel__content">
							<label className="studio-field">
								Text to add
								<input
									value={textDraft}
									onChange={(event) => setTextDraft(event.target.value)}
									placeholder="A moment worth keeping…"
								/>
							</label>
							<button
								className="studio-panel-action studio-action-button studio-action-button--primary"
								type="button"
								onClick={addText}
							>
								<Type aria-hidden="true" /> Add text
							</button>
						</div>
					) : null}
					{activePanel === "shapes" ? (
						<div className="studio-toolpanel__content">
							<p className="studio-panel-copy">
								Add a graphic accent, then resize, rotate, and layer it with
								your photo.
							</p>
							<div className="studio-shape-grid">
								{(
									[
										["rectangle", "Block"],
										["circle", "Circle"],
										["triangle", "Triangle"],
										["star", "Star"],
										["blob", "Blob"],
										["line", "Line"],
									] as [ShapeKind, string][]
								).map(([shape, label]) => (
									<button
										type="button"
										key={shape}
										onClick={() => addShape(shape)}
									>
										<span
											className={`studio-shape-swatch studio-shape-swatch--${shape}`}
											aria-hidden="true"
										/>
										{label}
									</button>
								))}
							</div>
						</div>
					) : null}
					{activePanel === "layers" ? (
						<div className="studio-toolpanel__content">
							<p className="studio-panel-copy">
								Drag a layer to change its stacking order. The first item is on
								top.
							</p>
							<div className="studio-layer-list">
								{document.elements.length === 0 ? (
									<p className="studio-panel-copy">
										Your layers will appear here.
									</p>
								) : (
									document.elements
										.slice()
										.reverse()
										.map((element) => (
											<button
												type="button"
												className={[
													layerDropId === element.id ? "is-drop-target" : "",
													layerDropId === element.id &&
													layerDropSide === "after"
														? "is-drop-after"
														: "",
													layerDragId === element.id ? "is-dragging" : "",
													selectedId === element.id ? "is-active" : "",
												]
													.filter(Boolean)
													.join(" ")}
												aria-grabbed={layerDragId === element.id}
												data-layer-id={element.id}
												onClick={() => selectLayer(element.id)}
												onPointerDown={(event) =>
													beginLayerPointerDrag(event, element.id)
												}
												onPointerMove={moveLayerPointerDrag}
												onPointerUp={endLayerPointerDrag}
												onPointerCancel={endLayerPointerDrag}
												key={element.id}
											>
												<span>
													<span
														className="studio-layer-grip"
														aria-hidden="true"
													>
														⠿
													</span>
													<span className="studio-layer-label">
														{getLayerLabel(
															element,
															element.type === "image"
																? assets.find(
																		(asset) => asset.id === element.assetId,
																	)?.name
																: undefined,
														)}
													</span>
												</span>
												<small>{element.id.slice(0, 6)}</small>
											</button>
										))
								)}
							</div>
							<div className="studio-layer-background">
								<span>
									<span className="studio-layer-grip" aria-hidden="true">
										◆
									</span>
									Canvas background
								</span>
								<small>Document</small>
							</div>
							{draggedLayer ? (
								<div
									className="studio-layer-drag-preview"
									style={{
										left: layerDragPosition.x + 14,
										top: layerDragPosition.y + 14,
									}}
									aria-hidden="true"
								>
									<span className="studio-layer-grip">⠿</span>
									<strong>
										{getLayerLabel(
											draggedLayer,
											draggedLayer.type === "image"
												? assets.find(
														(asset) => asset.id === draggedLayer.assetId,
													)?.name
												: undefined,
										)}
									</strong>
									<small>{draggedLayer.id.slice(0, 6)}</small>
								</div>
							) : null}
						</div>
					) : null}
				</aside>
				<main className="studio-workspace">
					<div className="studio-workspace__heading">
						<div>
							<span className="studio-app__eyebrow">Print preview</span>
							<h1>{getProduct(document.productId)?.name ?? "Print design"}</h1>
						</div>
						<div className="studio-workspace__zoom">
							<span>{Math.round(zoom * 100)}%</span>
							<button
								className="studio-action-button studio-action-button--quiet"
								type="button"
								onClick={() => setZoom(0.9)}
							>
								Fit
							</button>
							<input
								aria-label="Zoom"
								type="range"
								min="0.5"
								max="1.4"
								step="0.05"
								value={zoom}
								onChange={(event) => setZoom(Number(event.target.value))}
							/>
						</div>
					</div>
					{!orientationDismissed ? (
						<div className="studio-orientation" role="status">
							<span>
								<strong>Quick tip:</strong> Select a layer to adjust it, then
								save when you’re ready.
							</span>
							<button
								className="studio-icon-button studio-icon-button--quiet"
								type="button"
								onClick={() => setOrientationDismissed(true)}
								aria-label="Dismiss studio tip"
							>
								×
							</button>
						</div>
					) : null}
					<div className="studio-canvas-wrap studio-canvas-wrap--v2">
						<div
							ref={canvasRef}
							className="studio-canvas"
							style={{
								width: document.width * zoom,
								height: document.height * zoom,
								background: document.background,
							}}
							onPointerMove={moveDrag}
							onPointerUp={endDrag}
							onPointerCancel={endDrag}
						>
							{document.elements.map((element, elementIndex) => {
								const asset =
									element.type === "image"
										? assets.find((item) => item.id === element.assetId)
										: undefined;
								const selected = selectedId === element.id;
								return (
									<button
										key={element.id}
										type="button"
										className={[
											"studio-element",
											`studio-element--${element.type}`,
											selected ? "is-selected" : "",
										]
											.filter(Boolean)
											.join(" ")}
										data-shape={
											element.type === "shape" ? element.shape : undefined
										}
										aria-label={
											element.type === "image"
												? (asset?.name ?? "Photo layer")
												: element.type === "text"
													? element.text
													: `${element.shape} layer`
										}
										aria-pressed={selected}
										style={{
											left: element.x * zoom,
											top: element.y * zoom,
											zIndex: elementIndex + 2,
											width:
												element.type === "text"
													? (element.width ?? document.width * 0.8) * zoom
													: "width" in element
														? element.width * zoom
														: undefined,
											height:
												element.type === "text"
													? element.height
														? element.height * zoom
														: undefined
													: "height" in element
														? element.height * zoom
														: undefined,
											transform: `rotate(${element.rotation}deg)`,
											fontSize:
												element.type === "text"
													? element.fontSize * zoom
													: undefined,
											color:
												element.type === "text" ? element.color : undefined,
											background:
												element.type === "shape" ? element.fill : undefined,
											borderRadius:
												element.type === "shape" && element.shape === "circle"
													? "50%"
													: undefined,
											clipPath:
												element.type === "shape" && element.shape === "triangle"
													? "polygon(50% 0, 100% 100%, 0 100%)"
													: element.type === "shape" && element.shape === "star"
														? "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 100%, 50% 74%, 21% 100%, 32% 57%, 2% 35%, 39% 35%)"
														: undefined,
										}}
										onPointerDown={(event) => beginDrag(event, element)}
										onKeyDown={moveSelectedWithKeyboard}
									>
										{element.type === "image" && asset ? (
											<img
												src={asset.dataUrl}
												alt={asset.name}
												draggable={false}
												style={{
													objectPosition: `${element.cropX * 100}% ${element.cropY * 100}%`,
												}}
											/>
										) : element.type === "text" ? (
											element.text
										) : null}
									</button>
								);
							})}
							{selectedElement && selectedBounds ? (
								<div
									className="studio-selection-controls"
									style={{
										left: selectedBounds.x * zoom,
										top: selectedBounds.y * zoom,
										width: selectedBounds.width * zoom,
										height: selectedBounds.height * zoom,
										transform: `rotate(${selectedElement.rotation}deg)`,
									}}
								>
									<button
										className="studio-rotate-handle"
										type="button"
										aria-label="Rotate selected layer"
										onPointerDown={(event) =>
											beginRotate(event, selectedElement)
										}
									>
										<RotateCw aria-hidden="true" />
									</button>
									{(["nw", "ne", "sw", "se"] as ResizeHandle[]).map(
										(handle) => (
											<button
												key={handle}
												className={`studio-resize-handle studio-resize-handle--${handle}`}
												type="button"
												aria-label={`Resize selected layer ${handle}`}
												onPointerDown={(event) =>
													beginResize(event, selectedElement, handle)
												}
											>
												<MoveDiagonal2 aria-hidden="true" />
											</button>
										),
									)}
								</div>
							) : null}
							<div className="studio-safe-area" aria-hidden="true" />
						</div>
					</div>
					<div className="studio-workspace__hint">
						Drag to move. Use the corner handles to resize and the top handle to
						rotate. Arrow keys give precise movement; the dashed line is a
						safe-area guide.
					</div>
				</main>
				<aside className="studio-inspector" aria-label="Selection inspector">
					<span className="studio-app__eyebrow">Inspector</span>
					{selectedElement ? (
						<>
							<h2>
								{selectedElement.type === "image"
									? "Photo"
									: selectedElement.type === "text"
										? "Text layer"
										: "Shape"}
							</h2>
							<p className="studio-selection">
								{selectedElement.type === "image"
									? (assets.find((item) => item.id === selectedElement.assetId)
											?.name ?? "Photo")
									: selectedElement.type === "text"
										? selectedElement.text
										: selectedElement.shape}
							</p>
							{selectedElement.type === "text" ? (
								<>
									<label className="studio-field">
										Text
										<input
											key={selectedElement.id}
											defaultValue={selectedElement.text}
											onBlur={(event) => {
												const text = event.currentTarget.value.trim();
												if (text && text !== selectedElement.text)
													updateSelected({ text });
											}}
										/>
										<small>Use a place, date, or short note.</small>
									</label>
									<label className="studio-field">
										Font size
										<input
											type="number"
											min="8"
											max="400"
											value={Math.round(selectedElement.fontSize)}
											onChange={(event) =>
												updateSelected({
													fontSize: Math.min(
														400,
														Math.max(8, Number(event.target.value)),
													),
												})
											}
										/>
									</label>
								</>
							) : null}
							{selectedElement.type === "image" ? (
								<>
									<label className="studio-field">
										Crop horizontal
										<input
											type="range"
											min="0"
											max="1"
											step="0.05"
											value={selectedElement.cropX}
											onChange={(event) =>
												updateSelected({ cropX: Number(event.target.value) })
											}
										/>
									</label>
									<label className="studio-field">
										Crop vertical
										<input
											type="range"
											min="0"
											max="1"
											step="0.05"
											value={selectedElement.cropY}
											onChange={(event) =>
												updateSelected({ cropY: Number(event.target.value) })
											}
										/>
									</label>
									<p className="studio-quality">
										{(() => {
											const asset = assets.find(
												(item) => item.id === selectedElement.assetId,
											);
											const product = getProduct(document.productId);
											const inches = product
												? ((selectedElement.width / document.width) *
														product.widthMm) /
													25.4
												: 1;
											const dpi = asset ? Math.round(asset.width / inches) : 0;
											return dpi >= (product?.qualityDpi ?? 300)
												? `Good quality · ${dpi} dpi`
												: `Review quality · ${dpi} dpi`;
										})()}
									</p>
								</>
							) : null}
							<div className="studio-control-row">
								<button
									className="studio-action-button"
									type="button"
									onClick={() => {
										const index = document.elements.findIndex(
											(element) => element.id === selectedElement.id,
										);
										if (index < document.elements.length - 1) {
											const elements = [...document.elements];
											const current = elements[index];
											const next = elements[index + 1];
											if (!current || !next) return;
											[elements[index], elements[index + 1]] = [next, current];
											commit({ ...document, elements });
										}
									}}
								>
									<ArrowUp aria-hidden="true" /> Forward
								</button>
								<button
									className="studio-action-button"
									type="button"
									onClick={() => {
										const index = document.elements.findIndex(
											(element) => element.id === selectedElement.id,
										);
										if (index > 0) {
											const elements = [...document.elements];
											const current = elements[index];
											const previous = elements[index - 1];
											if (!current || !previous) return;
											[elements[index - 1], elements[index]] = [
												current,
												previous,
											];
											commit({ ...document, elements });
										}
									}}
								>
									<ArrowDown aria-hidden="true" /> Back
								</button>
							</div>
							<button
								className="studio-danger studio-action-button studio-action-button--danger"
								type="button"
								onClick={removeSelected}
							>
								<Trash2 aria-hidden="true" /> Remove layer
							</button>
						</>
					) : (
						<div className="studio-inspector__empty">
							<span aria-hidden="true">✦</span>
							<h2>Select a layer</h2>
							<p>
								Choose an element on the artboard to inspect its crop, quality,
								and layer order.
							</p>
							<label className="studio-field">
								Canvas background
								<select
									value={document.background}
									onChange={(event) =>
										commit({ ...document, background: event.target.value })
									}
								>
									<option value="#f7f0e5">Warm paper</option>
									<option value="#ffffff">Gallery white</option>
									<option value="#20201e">Ink black</option>
									<option value="#dce8e4">Soft sage</option>
								</select>
							</label>
						</div>
					)}
				</aside>
			</div>
			<nav className="studio-mobile-dock" aria-label="Mobile studio tools">
				{(
					[
						["templates", "Templates"],
						["photos", "Photos"],
						["text", "Text"],
						["shapes", "Shapes"],
						["layers", "Layers"],
					] as const
				).map(([tool, label]) => (
					<button
						type="button"
						className={activePanel === tool ? "is-active" : ""}
						onClick={() => selectTool(tool)}
						key={tool}
					>
						<span aria-hidden="true">
							{tool === "templates"
								? "✦"
								: tool === "photos"
									? "◈"
									: tool === "text"
										? "T"
										: tool === "shapes"
											? "◇"
											: "≡"}
						</span>
						{label}
					</button>
				))}
			</nav>
			{authPrompt ? (
				<div className="studio-dialog-backdrop" role="presentation">
					<section
						className="studio-dialog studio-auth-prompt"
						role="dialog"
						aria-modal="true"
						aria-labelledby="auth-required-title"
					>
						<button
							className="studio-dialog__close studio-icon-button studio-icon-button--quiet"
							type="button"
							aria-label="Close sign-in prompt"
							onClick={() => setAuthPrompt(null)}
						>
							×
						</button>
						<span className="studio-app__eyebrow">Keep your design moving</span>
						<h2 id="auth-required-title">Sign in to continue</h2>
						<p>
							{authPrompt === "export"
								? "Sign in to export your design or copy its browser link."
								: "Sign in to send this design for a studio review."}
						</p>
						<div className="studio-dialog__actions">
							<Button
								className="studio-action-button studio-action-button--primary"
								onClick={() => {
									const action = authPrompt;
									setAuthPrompt(null);
									if (action) redirectToAuth(action);
								}}
							>
								Continue to sign in
							</Button>
							<Button
								className="studio-action-button"
								variant="outline"
								onClick={() => setAuthPrompt(null)}
							>
								Keep editing
							</Button>
						</div>
					</section>
				</div>
			) : null}
			{requestOpen ? (
				<div className="studio-dialog-backdrop" role="presentation">
					<section
						className="studio-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="request-title"
					>
						<button
							className="studio-dialog__close studio-icon-button studio-icon-button--quiet"
							type="button"
							aria-label="Close request dialog"
							onClick={() => setRequestOpen(false)}
						>
							×
						</button>
						<span className="studio-app__eyebrow">One last detail</span>
						<h2 id="request-title">Request a studio review</h2>
						<p>
							No payment is taken. This demo stores a request for a future print
							workflow.
						</p>
						{requestError ? (
							<p
								ref={requestErrorRef}
								className="studio-dialog__error"
								role="alert"
								aria-live="assertive"
								tabIndex={-1}
							>
								<CircleAlert aria-hidden="true" />
								<span>{requestError}</span>
							</p>
						) : null}
						<form onSubmit={requestOrder}>
							<label className="studio-field">
								Name
								<input
									required
									name="contactName"
									autoComplete="name"
									value={contactName}
									onChange={(event) => {
										setContactName(event.target.value);
										setRequestError(null);
									}}
									placeholder="Your name…"
								/>
							</label>
							<label className="studio-field">
								Email
								<input
									required
									type="email"
									name="contactEmail"
									autoComplete="email"
									value={contactEmail}
									onChange={(event) => {
										setContactEmail(event.target.value);
										setRequestError(null);
									}}
									placeholder="you@example.com…"
								/>
							</label>
							<label className="studio-field">
								Quantity
								<input
									required
									type="number"
									name="quantity"
									min="1"
									max="100"
									value={quantity}
									onChange={(event) =>
										setQuantity(Math.max(1, Number(event.target.value)))
									}
								/>
							</label>
							<Button
								className="studio-action-button studio-action-button--primary"
								type="submit"
								disabled={submitOrder.isPending}
							>
								<Send data-icon="inline-start" aria-hidden="true" />
								{submitOrder.isPending ? "Sending…" : "Submit demo request"}
							</Button>
						</form>
					</section>
				</div>
			) : null}
		</div>
	);
}
