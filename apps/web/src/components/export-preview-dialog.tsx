import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

import { canInlineExportPreview } from "../lib/design-export";
import ModalDialog from "./modal-dialog";

export type ExportPreviewFormat = "png" | "jpeg" | "svg";

type ExportPreviewDialogProps = {
	blob: Blob;
	format: ExportPreviewFormat;
	filename: string;
	width: number;
	height: number;
	onClose: () => void;
};

type PreviewState =
	| {
			blob: Blob;
			format: ExportPreviewFormat;
			status: "loading";
			dataUrl?: string;
	  }
	| {
			blob: Blob;
			format: ExportPreviewFormat;
			status: "ready";
			dataUrl: string;
	  }
	| {
			blob: Blob;
			format: ExportPreviewFormat;
			status: "error";
			message: string;
			downloadUrl?: string;
	  };

const PREVIEW_TIMEOUT_MS = 30_000;
const DOWNLOAD_URL_LIFETIME_MS = 30_000;

const mimeTypes: Record<ExportPreviewFormat, string> = {
	png: "image/png",
	jpeg: "image/jpeg",
	svg: "image/svg+xml",
};

function safeFilename(value: string, format: ExportPreviewFormat) {
	const cleaned = Array.from(value)
		.map((character) => {
			const code = character.codePointAt(0) ?? 0;
			return /[\\/:*?"<>|]/.test(character) || code < 32 || code === 127
				? "-"
				: character;
		})
		.join("")
		.slice(0, 120);
	const base =
		cleaned.replace(/\.(?:png|jpe?g|svg)$/i, "") || "printclub-preview";
	return `${base}.${format === "jpeg" ? "jpg" : format}`;
}

export default function ExportPreviewDialog({
	blob,
	format,
	filename,
	width,
	height,
	onClose,
}: ExportPreviewDialogProps) {
	const [preview, setPreview] = useState<PreviewState>({
		blob,
		format,
		status: "loading",
	});
	const visiblePreview =
		preview.blob === blob && preview.format === format
			? preview
			: { blob, format, status: "loading" as const };
	const downloadHref =
		visiblePreview.status === "ready"
			? visiblePreview.dataUrl
			: visiblePreview.status === "error"
				? visiblePreview.downloadUrl
				: undefined;
	const downloadFilename = safeFilename(filename, format);
	const previewHeading =
		visiblePreview.status === "loading"
			? `Preparing your ${format.toUpperCase()} preview`
			: visiblePreview.status === "ready"
				? `Your ${format.toUpperCase()} is ready`
				: visiblePreview.downloadUrl
					? `Your ${format.toUpperCase()} is ready to download`
					: "Preview unavailable";

	useEffect(() => {
		let active = true;
		let settled = false;
		let reader: FileReader | undefined;
		let image: HTMLImageElement | undefined;
		let oversizedDownloadUrl: string | undefined;
		const timeout = window.setTimeout(() => {
			if (!active || settled) return;
			settled = true;
			reader?.abort();
			if (image) image.src = "";
			setPreview({
				blob,
				format,
				status: "error",
				message:
					"The preview took too long to prepare. Close this window and try exporting again.",
			});
		}, PREVIEW_TIMEOUT_MS);
		const finish = (next: PreviewState) => {
			if (!active || settled) return;
			settled = true;
			window.clearTimeout(timeout);
			setPreview(next);
		};
		const cleanup = () => {
			active = false;
			window.clearTimeout(timeout);
			if (reader?.readyState === FileReader.LOADING) reader.abort();
			if (image) {
				image.onload = null;
				image.onerror = null;
				image.src = "";
			}
			if (oversizedDownloadUrl) {
				const url = oversizedDownloadUrl;
				window.setTimeout(
					() => URL.revokeObjectURL(url),
					DOWNLOAD_URL_LIFETIME_MS,
				);
			}
		};
		const expectedMime = mimeTypes[format];
		const actualMime = blob.type.split(";", 1)[0]?.trim().toLowerCase();
		if (!blob.size || actualMime !== expectedMime) {
			finish({
				blob,
				format,
				status: "error",
				message:
					"The export file appears to be incomplete. Close this preview and try exporting again.",
			});
			return cleanup;
		}
		if (!canInlineExportPreview(blob.size)) {
			try {
				oversizedDownloadUrl = URL.createObjectURL(blob);
				finish({
					blob,
					format,
					status: "error",
					message:
						"This export is too large to preview inline in this browser. Use the download link to save the file.",
					downloadUrl: oversizedDownloadUrl,
				});
			} catch {
				finish({
					blob,
					format,
					status: "error",
					message:
						"This export is too large to preview in this browser. Reduce the canvas size and try again.",
				});
			}
			return cleanup;
		}

		reader = new FileReader();
		reader.onload = () => {
			if (!active) return;
			if (
				typeof reader.result !== "string" ||
				!reader.result.startsWith("data:")
			) {
				finish({
					blob,
					format,
					status: "error",
					message:
						"The preview could not be prepared. Close this window and export again.",
				});
				return;
			}
			const dataUrl = reader.result;
			setPreview({ blob, format, status: "loading", dataUrl });
			image = new Image();
			image.onload = () => {
				if (image?.naturalWidth !== width || image?.naturalHeight !== height) {
					finish({
						blob,
						format,
						status: "error",
						message:
							"The preview dimensions did not match the export. Close this window and try again.",
					});
					return;
				}
				finish({ blob, format, status: "ready", dataUrl });
			};
			image.onerror = () => {
				finish({
					blob,
					format,
					status: "error",
					message:
						"The preview could not be decoded in this browser. Close this window and try exporting again.",
				});
			};
			image.src = dataUrl;
		};
		reader.onerror = () => {
			finish({
				blob,
				format,
				status: "error",
				message:
					"The preview could not be loaded in this browser. Close this window and try exporting again.",
			});
		};
		reader.onabort = () => {
			finish({
				blob,
				format,
				status: "error",
				message: "Preview loading was interrupted. Try exporting again.",
			});
		};
		try {
			reader.readAsDataURL(blob);
		} catch {
			finish({
				blob,
				format,
				status: "error",
				message:
					"The preview could not be loaded in this browser. Close this window and try exporting again.",
			});
		}

		return cleanup;
	}, [blob, format, height, width]);

	return (
		<ModalDialog
			className="studio-dialog studio-export-preview"
			labelledBy="studio-export-preview-title"
			onClose={onClose}
		>
			<button
				className="studio-dialog__close studio-icon-button"
				type="button"
				aria-label="Close export preview"
				data-dialog-close
				onClick={onClose}
			>
				<X aria-hidden="true" />
			</button>

			<p className="eyebrow">Export preview</p>
			<h2 id="studio-export-preview-title">{previewHeading}</h2>
			<p className="studio-export-preview__dimensions">
				{width.toLocaleString()} × {height.toLocaleString()} pixels
			</p>

			<div
				className="studio-export-preview__image-wrap"
				aria-busy={visiblePreview.status === "loading"}
			>
				{visiblePreview.status === "loading" ? (
					visiblePreview.dataUrl ? (
						<img
							className="studio-export-preview__image"
							src={visiblePreview.dataUrl}
							alt={`Preview of your ${format.toUpperCase()} design`}
							width={width}
							height={height}
						/>
					) : (
						<p role="status">Preparing the preview…</p>
					)
				) : visiblePreview.status === "error" ? (
					<p className="studio-export-preview__error" role="alert">
						{visiblePreview.message}
					</p>
				) : (
					<img
						className="studio-export-preview__image"
						src={visiblePreview.dataUrl}
						alt={`Preview of your ${format.toUpperCase()} design`}
						width={width}
						height={height}
					/>
				)}
			</div>

			<p className="studio-export-preview__notice">
				This is a design preview for your browser. It is not a print-certified
				production file.
			</p>

			{downloadHref ? (
				<a
					className="studio-export-preview__download"
					href={downloadHref}
					download={downloadFilename}
				>
					<Download aria-hidden="true" />
					Download {format.toUpperCase()}
				</a>
			) : null}
		</ModalDialog>
	);
}
