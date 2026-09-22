import {
	catalog,
	type DesignElement,
	getProduct,
} from "@PhotoPrinting/api/domain/print";
import { Button } from "@PhotoPrinting/ui/components/button";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	ImagePlus,
	Minus,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
	buildCreationDocument,
	type CreationDraft,
	type CreationStep,
	createAssetFromFile,
	createCreationDraft,
	findResumableCreationDraft,
	getCreationDraft,
	loadCreationDraft,
	productImages,
	type StoredAsset,
	saveCreationDraft,
	type TemplateId,
	templateDefinitions,
} from "@/lib/creation-draft";

type CreationSearch = {
	product?: string;
	template?: TemplateId;
	step?: number;
	draft?: string;
	resume?: boolean;
};

function parseCreationSearch(search: Record<string, unknown>): CreationSearch {
	const template =
		typeof search.template === "string" &&
		["blank", "caption", "gallery", "celebration"].includes(search.template)
			? (search.template as TemplateId)
			: undefined;
	const parsedStep = Number(search.step);
	return {
		product: typeof search.product === "string" ? search.product : undefined,
		template,
		step:
			Number.isInteger(parsedStep) && parsedStep >= 1 && parsedStep <= 3
				? parsedStep
				: undefined,
		draft: typeof search.draft === "string" ? search.draft : undefined,
		resume: search.resume === true || search.resume === "true",
	};
}

export const Route = createFileRoute("/create")({
	validateSearch: parseCreationSearch,
	head: () => ({
		meta: [
			{ title: "Create a print · printclub" },
			{
				name: "description",
				content:
					"Choose a format, prepare your photos, and open the printclub studio.",
			},
		],
	}),
	component: CreationPage,
});

const stepLabels = [
	"Choose format",
	"Prepare design",
	"Review & continue",
] as const;

function rebuildDocument(
	draft: CreationDraft,
	assets = draft.assets,
): CreationDraft["document"] {
	return draft.started
		? buildCreationDocument(draft.productId, draft.templateId, assets)
		: buildCreationDocument(draft.productId, "blank", assets);
}

function formatTemplateChoice(templateId: TemplateId) {
	if (templateId === "blank") return "Blank design";
	return (
		templateDefinitions.find((template) => template.id === templateId)?.label ??
		"Template"
	);
}

function CreationPage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/create" });
	const [draft, setDraft] = useState<CreationDraft | null>(null);
	const [resumeCandidate, setResumeCandidate] = useState<CreationDraft | null>(
		null,
	);
	const [step, setStep] = useState<CreationStep>(1);
	const [status, setStatus] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const isLoading = draft === null;
	const product = useMemo(
		() =>
			getProduct(draft?.productId ?? search.product ?? "classic-10x15") ??
			catalog[0],
		[draft?.productId, search.product],
	);

	useEffect(() => {
		let cancelled = false;
		async function hydrate() {
			const existing = search.draft
				? await getCreationDraft(search.draft)
				: search.resume
					? await loadCreationDraft()
					: null;
			const resumable =
				!existing && !search.draft && !search.resume
					? await findResumableCreationDraft()
					: null;
			const next =
				existing ??
				(await createCreationDraft(
					getProduct(search.product ?? "classic-10x15")?.id ?? "classic-10x15",
					search.template ?? "blank",
				));
			if (cancelled) return;
			setDraft(next);
			setResumeCandidate(resumable);
			setStep((search.step ?? next.step ?? 1) as CreationStep);
			if (search.resume && existing)
				setStatus("Your saved browser draft is ready.");
		}
		void hydrate();
		return () => {
			cancelled = true;
		};
	}, [
		search.draft,
		search.product,
		search.resume,
		search.step,
		search.template,
	]);

	function persist(next: CreationDraft, nextStep = step) {
		const updated = { ...next, step: nextStep as CreationStep };
		setDraft(updated);
		void saveCreationDraft(updated);
	}

	function syncUrl(nextStep: CreationStep, nextDraft: CreationDraft) {
		void navigate({
			to: "/create",
			search: {
				product: nextDraft.productId,
				template:
					nextDraft.templateId === "blank" ? undefined : nextDraft.templateId,
				step: nextStep,
				draft: nextDraft.id,
			},
		});
	}

	function goToStep(nextStep: CreationStep) {
		if (!draft) return;
		if (nextStep === 3 && !draft.started) {
			setStatus("Choose a template, add a photo, or select Start blank first.");
			setStep(2);
			return;
		}
		setStatus("");
		setStep(nextStep);
		const updated = { ...draft, step: nextStep };
		setDraft(updated);
		void saveCreationDraft(updated);
		syncUrl(nextStep, updated);
	}

	function changeProduct(productId: string) {
		if (!draft || !getProduct(productId)) return;
		const next = { ...draft, productId };
		persist({ ...next, document: rebuildDocument(next) });
		setStatus(`${getProduct(productId)?.name} selected.`);
	}

	function chooseTemplate(templateId: TemplateId) {
		if (!draft) return;
		const next = { ...draft, templateId, started: true };
		persist({ ...next, document: rebuildDocument(next) });
		setStatus(`${formatTemplateChoice(templateId)} selected.`);
	}

	async function importFiles(files: FileList | null) {
		if (!draft || !files?.length) return;
		setIsProcessing(true);
		setStatus("Preparing your photo…");
		const imported: StoredAsset[] = [];
		for (const file of Array.from(files)) {
			try {
				imported.push(await createAssetFromFile(file));
			} catch (error) {
				setStatus(
					error instanceof Error
						? error.message
						: "This photo could not be added.",
				);
			}
		}
		if (imported.length) {
			const assets = [...draft.assets, ...imported];
			const next = { ...draft, assets, started: true };
			persist({ ...next, document: rebuildDocument(next, assets) });
			setStatus(
				`${imported.length} photo${imported.length === 1 ? "" : "s"} ready. Additional photos stay available in the studio.`,
			);
		}
		setIsProcessing(false);
		if (fileRef.current) fileRef.current.value = "";
	}

	function removeAsset(assetId: string) {
		if (!draft) return;
		const assets = draft.assets.filter((asset) => asset.id !== assetId);
		const next = {
			...draft,
			assets,
			started: draft.started || assets.length > 0,
		};
		persist({ ...next, document: rebuildDocument(next, assets) });
		setStatus("Photo removed from this setup.");
	}

	async function continueAsGuest() {
		if (!draft) return;
		const next = { ...draft, step: 3 as CreationStep };
		persist(next, 3);
		await saveCreationDraft(next);
		await navigate({ to: "/studio", search: { draft: draft.id } });
	}

	if (isLoading || !draft) {
		return (
			<main className="creation-page" id="main-content">
				<div className="creation-loading" role="status">
					Preparing your print setup…
				</div>
			</main>
		);
	}

	return (
		<main className="creation-page" id="main-content">
			<div className="creation-shell">
				<header className="creation-header">
					<div>
						<p className="eyebrow eyebrow--blue">Print setup</p>
						<h1>Create a print</h1>
					</div>
					<Link className="creation-exit" to="/">
						Exit setup
					</Link>
				</header>
				<div className="creation-progress">
					<div className="creation-progress__meta">
						<span>Step {step} of 3</span>
						<strong>{stepLabels[step - 1]}</strong>
					</div>
					<div
						className="creation-progress__bar"
						role="progressbar"
						aria-label="Creation progress"
						aria-valuemin={1}
						aria-valuemax={3}
						aria-valuenow={step}
					>
						<span style={{ width: `${(step / 3) * 100}%` }} />
					</div>
					{step > 1 ? (
						<button
							className="creation-progress__back"
							type="button"
							onClick={() => goToStep((step - 1) as CreationStep)}
						>
							Back to {stepLabels[step - 2]}
						</button>
					) : null}
				</div>

				{step === 1 ? (
					<ChooseFormatStep
						product={product}
						selectedId={draft.productId}
						onSelect={changeProduct}
						resumeCandidate={resumeCandidate}
						onResume={() => {
							if (!resumeCandidate) return;
							void navigate({
								to: "/create",
								search: {
									draft: resumeCandidate.id,
									step: resumeCandidate.step,
									product: resumeCandidate.productId,
								},
							});
						}}
					/>
				) : null}
				{step === 2 ? (
					<PrepareStep
						draft={draft}
						product={product}
						isProcessing={isProcessing}
						status={status}
						fileRef={fileRef}
						onImport={importFiles}
						onRemoveAsset={removeAsset}
						onChooseTemplate={chooseTemplate}
						onStartBlank={() => chooseTemplate("blank")}
					/>
				) : null}
				{step === 3 ? (
					<ReviewStep
						draft={draft}
						product={product}
						status={status}
						onProjectName={(projectName) => persist({ ...draft, projectName })}
						onGuest={continueAsGuest}
						onEditFormat={() => goToStep(1)}
						onEditPhotos={() => goToStep(2)}
					/>
				) : null}

				<div className="creation-footer">
					{step > 1 ? (
						<Button
							type="button"
							variant="outline"
							onClick={() => goToStep((step - 1) as CreationStep)}
						>
							<ArrowLeft aria-hidden="true" /> Back
						</Button>
					) : (
						<span />
					)}
					{step < 3 ? (
						<Button
							type="button"
							onClick={() => goToStep((step + 1) as CreationStep)}
						>
							{step === 1 ? "Next: Add your photos" : "Next: Review"}
							<ArrowRight aria-hidden="true" />
						</Button>
					) : null}
				</div>
				{status ? (
					<p className="creation-status" role="status">
						{status}
					</p>
				) : null}
			</div>
		</main>
	);
}

function ChooseFormatStep({
	product,
	selectedId,
	onSelect,
	resumeCandidate,
	onResume,
}: {
	product: (typeof catalog)[number];
	selectedId: string;
	onSelect: (productId: string) => void;
	resumeCandidate: CreationDraft | null;
	onResume: () => void;
}) {
	return (
		<section
			className="creation-content creation-content--format"
			aria-labelledby="format-step-title"
		>
			<div className="creation-format-heading">
				<p className="eyebrow">Choose your format</p>
				<h2 id="format-step-title">Pick a format for your print.</h2>
				<p>Choose a starting size. You can change the crop in the studio.</p>
			</div>
			{resumeCandidate ? (
				<div className="creation-resume-card">
					<div>
						<span className="eyebrow eyebrow--blue">Already started</span>
						<strong>{resumeCandidate.projectName}</strong>
						<span>
							{resumeCandidate.assets.length} photo
							{resumeCandidate.assets.length === 1 ? "" : "s"} · saved in this
							browser
						</span>
					</div>
					<Button type="button" variant="outline" onClick={onResume}>
						Resume saved design <ArrowRight aria-hidden="true" />
					</Button>
				</div>
			) : null}
			<div className="creation-format-workspace">
				<ul className="creation-format-grid" aria-label="Print formats">
					{catalog.map((option) => (
						<li key={option.id}>
							<button
								type="button"
								className={`creation-format-card ${option.id === selectedId ? "is-selected" : ""}`}
								onClick={() => onSelect(option.id)}
								aria-pressed={option.id === selectedId}
							>
								<span
									className={`creation-format-card__shape format-shape--${option.kind}`}
									aria-hidden="true"
								/>
								<span className="creation-format-card__number">
									{option.id === selectedId ? (
										<Check aria-hidden="true" />
									) : (
										`0${catalog.indexOf(option) + 1}`
									)}
								</span>
								<strong>{option.name}</strong>
								<small>
									{option.widthMm} × {option.heightMm} mm · {option.finish}
								</small>
							</button>
						</li>
					))}
				</ul>
				<div className="creation-format-summary">
					<div className="creation-format-summary__copy">
						<p className="eyebrow">Selected format</p>
						<strong>{product.name}</strong>
						<span>
							{product.widthMm} × {product.heightMm} mm · {product.finish}
						</span>
					</div>
					<FormatMockup product={product} />
				</div>
			</div>
		</section>
	);
}

function PrepareStep({
	draft,
	product,
	isProcessing,
	status,
	fileRef,
	onImport,
	onRemoveAsset,
	onChooseTemplate,
	onStartBlank,
}: {
	draft: CreationDraft;
	product: (typeof catalog)[number];
	isProcessing: boolean;
	status: string;
	fileRef: React.RefObject<HTMLInputElement | null>;
	onImport: (files: FileList | null) => void;
	onRemoveAsset: (assetId: string) => void;
	onChooseTemplate: (templateId: TemplateId) => void;
	onStartBlank: () => void;
}) {
	return (
		<section
			className="creation-content creation-content--prepare"
			aria-labelledby="prepare-step-title"
		>
			<div className="creation-prep-heading">
				<p className="eyebrow">Start your design</p>
				<h2 id="prepare-step-title">Start with photos or a template.</h2>
				<p>
					Choose how to begin. You can adjust the composition in the studio.
					This creates one design; quantity comes later when you submit a demo
					request.
				</p>
			</div>
			<div className="creation-prepare-grid">
				<div className="creation-panel">
					<div className="creation-panel__heading">
						<div>
							<span className="creation-panel__step">01</span>
							<h3>Add photos</h3>
						</div>
						<span>{draft.assets.length} ready</span>
					</div>
					<label className="creation-upload">
						<input
							ref={fileRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							multiple
							onChange={(event) => onImport(event.target.files)}
						/>
						<ImagePlus aria-hidden="true" />
						<strong>
							{isProcessing ? "Preparing photo…" : "Choose photos"}
						</strong>
						<small>JPEG, PNG, or WebP · up to 8 MB each</small>
					</label>
					{draft.assets.length ? (
						<ul className="creation-assets" aria-label="Imported photos">
							{draft.assets.map((asset) => (
								<li key={asset.id}>
									<img src={asset.dataUrl} alt="" />
									<span>{asset.name}</span>
									<button
										type="button"
										onClick={() => onRemoveAsset(asset.id)}
										aria-label={`Remove ${asset.name}`}
									>
										<Trash2 aria-hidden="true" />
									</button>
								</li>
							))}
						</ul>
					) : (
						<p className="creation-panel__hint">
							Your first photo will be placed in the preview automatically.
						</p>
					)}
				</div>
				<div className="creation-panel">
					<div className="creation-panel__heading">
						<div>
							<span className="creation-panel__step">02</span>
							<h3>Start with a template</h3>
						</div>
					</div>
					<div className="creation-template-grid">
						{templateDefinitions.map((template) => (
							<button
								type="button"
								key={template.id}
								className={
									draft.templateId === template.id ? "is-selected" : ""
								}
								onClick={() => onChooseTemplate(template.id)}
								aria-pressed={draft.templateId === template.id}
							>
								<img src={template.image} alt="" />
								<span>{template.label}</span>
								<small>{template.category}</small>
							</button>
						))}
					</div>
					<button
						type="button"
						className={`creation-blank ${draft.started && draft.templateId === "blank" ? "is-selected" : ""}`}
						onClick={onStartBlank}
						aria-pressed={draft.started && draft.templateId === "blank"}
					>
						<Minus aria-hidden="true" />
						<span>
							<strong>Start blank</strong>
							<small>Compose everything yourself</small>
						</span>
					</button>
					<p className="creation-panel__hint">
						{status ||
							"Templates are editable starting points, not locked layouts."}
					</p>
				</div>
			</div>
			<div className="creation-prep-preview">
				<div className="creation-prep-preview__copy">
					<p className="eyebrow">Live preview</p>
					<h3>See your starting point</h3>
					<p>Your photo or template appears here. Adjust it in the studio.</p>
				</div>
				<DraftCanvas draft={draft} product={product} />
			</div>
		</section>
	);
}

function ReviewStep({
	draft,
	product,
	status,
	onProjectName,
	onGuest,
	onEditFormat,
	onEditPhotos,
}: {
	draft: CreationDraft;
	product: (typeof catalog)[number];
	status: string;
	onProjectName: (name: string) => void;
	onGuest: () => void | Promise<void>;
	onEditFormat: () => void;
	onEditPhotos: () => void;
}) {
	return (
		<section
			className="creation-content creation-content--review"
			aria-labelledby="review-step-title"
		>
			<div className="creation-review-heading">
				<p className="eyebrow">Ready to continue</p>
				<h2 id="review-step-title">Review your print.</h2>
				<p>
					Name it, check the details, then choose how you want to continue. You
					can still adjust everything in the studio.
				</p>
			</div>
			<div className="creation-review-grid">
				<div className="creation-review-card">
					<label htmlFor="creation-project-name">Project name</label>
					<input
						id="creation-project-name"
						value={draft.projectName}
						onChange={(event) => onProjectName(event.target.value)}
						placeholder="Untitled memory"
					/>
					<dl>
						<div>
							<dt>Format</dt>
							<dd>{product.name}</dd>
						</div>
						<div>
							<dt>Size</dt>
							<dd>
								{product.widthMm} × {product.heightMm} mm
							</dd>
						</div>
						<div>
							<dt>Starting point</dt>
							<dd>{formatTemplateChoice(draft.templateId)}</dd>
						</div>
						<div>
							<dt>Photos</dt>
							<dd>{draft.assets.length} imported</dd>
						</div>
					</dl>
					<div className="creation-review-links">
						<button type="button" onClick={onEditFormat}>
							Change format
						</button>
						<button type="button" onClick={onEditPhotos}>
							Change photos
						</button>
					</div>
				</div>
				<div className="creation-auth-card">
					<span className="creation-auth-card__icon">
						<Sparkles aria-hidden="true" />
					</span>
					<h3>How do you want to continue?</h3>
					<p>
						Continue as a guest to edit now. Signing in or creating an account
						is optional in this demo and does not add cloud storage yet.
					</p>
					<Button type="button" onClick={() => void onGuest()}>
						Continue as guest <ArrowRight aria-hidden="true" />
					</Button>
					<a
						className="creation-auth-card__secondary"
						href={`/login?returnTo=${encodeURIComponent(`/studio?draft=${draft.id}`)}&mode=signin`}
					>
						Sign in and continue
					</a>
					<a
						className="creation-auth-card__secondary"
						href={`/login?returnTo=${encodeURIComponent(`/studio?draft=${draft.id}`)}&mode=signup`}
					>
						Create an account
					</a>
					<p className="creation-auth-card__note">
						Your design and photos stay in this browser. Cloud saving and
						sharing aren’t available yet.
					</p>
					{status ? (
						<p className="creation-panel__hint" role="status">
							{status}
						</p>
					) : null}
				</div>
			</div>
			<div className="creation-review-preview">
				<div className="creation-review-preview__copy">
					<p className="eyebrow">Live preview</p>
					<p>Your chosen format and starting point.</p>
				</div>
				<DraftCanvas draft={draft} product={product} />
			</div>
		</section>
	);
}

function FormatMockup({ product }: { product: (typeof catalog)[number] }) {
	return (
		<div
			className="creation-format-preview"
			role="img"
			aria-label={`${product.name} preview`}
		>
			<div className={`format-preview format-preview--${product.kind}`}>
				<div className="format-preview__print">
					<img src={productImages[product.kind]} alt="" />
				</div>
				<div className="format-preview__label">
					<strong>{product.name}</strong>
					<span>
						{product.widthMm} × {product.heightMm} mm
					</span>
				</div>
			</div>
		</div>
	);
}

function DraftCanvas({
	draft,
	product,
}: {
	draft: CreationDraft;
	product: (typeof catalog)[number];
}) {
	return (
		<div
			className="creation-draft-preview"
			role="img"
			style={{
				aspectRatio: `${draft.document.width} / ${draft.document.height}`,
			}}
			aria-label={`${product.name} design preview`}
		>
			<div
				className="creation-draft-preview__artboard"
				style={{ background: draft.document.background }}
			>
				{draft.document.elements.map((element) => (
					<DraftElement
						key={element.id}
						element={element}
						assets={draft.assets}
						document={draft.document}
					/>
				))}
				{draft.document.elements.length === 0 ? (
					<span className="creation-draft-preview__empty">
						Your composition will appear here
					</span>
				) : null}
			</div>
		</div>
	);
}

function DraftElement({
	element,
	assets,
	document,
}: {
	element: DesignElement;
	assets: StoredAsset[];
	document: CreationDraft["document"];
}) {
	const style: React.CSSProperties = {
		left: `${(element.x / document.width) * 100}%`,
		top: `${(element.y / document.height) * 100}%`,
		transform: `rotate(${element.rotation}deg)`,
	};
	if (element.type === "text") {
		const width = element.width ?? document.width * 0.8;
		const height = element.height ?? Math.max(32, element.fontSize * 1.3);
		style.width = `${(width / document.width) * 100}%`;
		style.height = `${(height / document.height) * 100}%`;
	}
	if (element.type === "image" || element.type === "shape") {
		style.width = `${(element.width / document.width) * 100}%`;
		style.height = `${(element.height / document.height) * 100}%`;
	}
	if (element.type === "text")
		return (
			<span
				className="creation-draft-preview__text"
				style={{
					...style,
					color: element.color,
					fontSize: `${Math.max(8, element.fontSize / 5)}px`,
				}}
			>
				{element.text}
			</span>
		);
	if (element.type === "shape")
		return (
			<span
				className={`creation-draft-preview__shape creation-draft-preview__shape--${element.shape}`}
				style={{ ...style, background: element.fill }}
			/>
		);
	const asset = assets.find((item) => item.id === element.assetId);
	return asset ? (
		<img
			className="creation-draft-preview__image"
			style={style}
			src={asset.dataUrl}
			alt=""
		/>
	) : null;
}
