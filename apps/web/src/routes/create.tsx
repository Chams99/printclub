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
	CircleAlert,
	ImagePlus,
	LoaderCircle,
	Minus,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { actionErrorMessage } from "@/lib/action-error";
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
import { responsiveImage } from "@/lib/images";
import { useAuthSession } from "@/lib/use-auth-session";

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
	const [draftLoadVersion, setDraftLoadVersion] = useState(0);
	const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
	const [missingExplicitDraft, setMissingExplicitDraft] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isNavigating, setIsNavigating] = useState(false);
	const actionErrorRef = useRef<HTMLDivElement>(null);
	// Keep mutable state synchronous with edits so async imports/undo callbacks
	// always build on the latest draft, even before React commits a render.
	const latestDraftRef = useRef<CreationDraft | null>(null);
	const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
	const importInProgressRef = useRef(false);
	const navigationInProgressRef = useRef(false);
	const [resumeCandidate, setResumeCandidate] = useState<CreationDraft | null>(
		null,
	);
	const [step, setStep] = useState<CreationStep>(1);
	const [status, setStatus] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const isLoading = draft === null && !draftLoadError;
	const isBusy = isProcessing || isSaving || isNavigating;
	const product = useMemo(
		() =>
			getProduct(draft?.productId ?? search.product ?? "classic-10x15") ??
			catalog[0],
		[draft?.productId, search.product],
	);

	useEffect(() => {
		let cancelled = false;
		async function hydrate() {
			setDraftLoadError(null);
			setMissingExplicitDraft(false);
			setDraft(null);
			latestDraftRef.current = null;
			try {
				const existing = search.draft
					? await getCreationDraft(search.draft)
					: search.resume
						? await loadCreationDraft()
						: null;
				if (search.draft && !existing) {
					if (cancelled) return;
					setDraftLoadError(
						"This setup link no longer has a saved draft in this browser. Return to the start and create a new print; your other saved designs are unchanged.",
					);
					setMissingExplicitDraft(true);
					return;
				}
				const resumable =
					!existing && !search.draft && !search.resume
						? await findResumableCreationDraft()
						: null;
				const next =
					existing ??
					(await createCreationDraft(
						getProduct(search.product ?? "classic-10x15")?.id ??
							"classic-10x15",
						search.template ?? "blank",
					));
				if (cancelled) return;
				latestDraftRef.current = next;
				setDraft(next);
				setResumeCandidate(resumable);
				setDraftLoadVersion((version) => version + 1);
				if (search.resume && existing)
					setStatus("Your saved browser draft is ready.");
			} catch (error) {
				if (!cancelled) setDraftLoadError(actionErrorMessage(error, "load"));
			}
		}
		void hydrate();
		return () => {
			cancelled = true;
		};
	}, [search.draft, search.product, search.resume, search.template]);

	// Browser Back/Forward changes only the visible step; it must not re-read a
	// draft while a newer in-memory edit is still waiting to be persisted.
	// biome-ignore lint/correctness/useExhaustiveDependencies: Draft-load version and URL step changes are the only step-selection events; tracking draft snapshots would reapply URL state after edits.
	useEffect(() => {
		if (!draft) return;
		const requestedStep = search.step as CreationStep | undefined;
		const nextStep = requestedStep ?? draft.step ?? 1;
		if (nextStep === 3 && !draft.started) {
			setStep(2);
			if (requestedStep === 3) {
				void goToStep(2);
				setStatus(
					"Choose a template, add a photo, or select Start blank first.",
				);
			}
			return;
		}
		setStep(nextStep);
	}, [draftLoadVersion, search.step]);

	useEffect(() => {
		if (!draftLoadVersion) return;
		const headingId =
			step === 1
				? "format-step-title"
				: step === 2
					? "prepare-step-title"
					: "review-step-title";
		const frame = window.requestAnimationFrame(() => {
			document.getElementById(headingId)?.focus({ preventScroll: true });
		});
		return () => window.cancelAnimationFrame(frame);
	}, [draftLoadVersion, step]);

	useEffect(() => {
		if (actionError) actionErrorRef.current?.focus();
	}, [actionError]);

	function persist(next: CreationDraft, nextStep = step): Promise<boolean> {
		const updated = { ...next, step: nextStep as CreationStep };
		latestDraftRef.current = updated;
		setDraft(updated);
		setIsSaving(true);
		const write = saveQueueRef.current
			.catch(() => undefined)
			.then(() => saveCreationDraft(updated));
		saveQueueRef.current = write;
		return write
			.then(
				() => {
					setActionError(null);
					return true;
				},
				(error: unknown) => {
					setActionError(actionErrorMessage(error, "save"));
					return false;
				},
			)
			.finally(() => {
				if (saveQueueRef.current === write) setIsSaving(false);
			});
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

	async function goToStep(nextStep: CreationStep) {
		const current = latestDraftRef.current;
		if (
			!current ||
			navigationInProgressRef.current ||
			importInProgressRef.current
		)
			return;
		if (nextStep === 3 && !current.started) {
			setStatus("Choose a template, add a photo, or select Start blank first.");
			setStep(2);
			return;
		}
		navigationInProgressRef.current = true;
		setIsNavigating(true);
		setStatus("");
		try {
			const updated = {
				...(latestDraftRef.current ?? current),
				step: nextStep,
			};
			if (!(await persist(updated, nextStep))) return;
			setStep(nextStep);
			syncUrl(nextStep, updated);
		} finally {
			navigationInProgressRef.current = false;
			setIsNavigating(false);
		}
	}

	function changeProduct(productId: string) {
		const current = latestDraftRef.current;
		if (!current || isBusy || !getProduct(productId)) return;
		const next = { ...current, productId };
		void persist({ ...next, document: rebuildDocument(next) });
		setStatus(`${getProduct(productId)?.name} selected.`);
	}

	function chooseTemplate(templateId: TemplateId) {
		const current = latestDraftRef.current;
		if (!current || isProcessing || isNavigating) return;
		const next = { ...current, templateId, started: true };
		void persist({ ...next, document: rebuildDocument(next) });
		setStatus(`${formatTemplateChoice(templateId)} selected.`);
	}

	async function importFiles(files: FileList | null) {
		const current = latestDraftRef.current;
		if (
			!current ||
			!files?.length ||
			importInProgressRef.current ||
			navigationInProgressRef.current
		)
			return;
		importInProgressRef.current = true;
		setIsProcessing(true);
		setStatus("Preparing your photo…");
		try {
			const imported: StoredAsset[] = [];
			const errors: string[] = [];
			let rejectedCount = 0;
			const selected = Array.from(files);
			const remaining = Math.max(0, 30 - current.assets.length);
			const accepted = selected.slice(0, remaining);
			if (selected.length > accepted.length) {
				rejectedCount += selected.length - accepted.length;
				errors.push(
					`You can keep up to 30 photos in one design. ${selected.length - accepted.length} photo${selected.length - accepted.length === 1 ? " was" : "s were"} not added.`,
				);
			}
			for (const file of accepted) {
				try {
					imported.push(await createAssetFromFile(file));
				} catch (error) {
					rejectedCount += 1;
					const message = actionErrorMessage(error, "photo");
					if (!errors.includes(message)) errors.push(message);
				}
			}
			if (imported.length) {
				const latest = latestDraftRef.current ?? current;
				const assets = [...latest.assets, ...imported].slice(0, 30);
				const next = { ...latest, assets, started: true };
				const saved = await persist({
					...next,
					document: rebuildDocument(next, assets),
				});
				if (saved) {
					setStatus(
						`${imported.length} photo${imported.length === 1 ? "" : "s"} ready${rejectedCount ? `; ${rejectedCount} item${rejectedCount === 1 ? " was" : "s were"} skipped.` : ". Additional photos stay available in the studio."}`,
					);
				}
			}
			if (errors.length) setActionError(errors.join(" "));
			else if (!imported.length) setStatus("No photos were added.");
		} catch (error) {
			setActionError(actionErrorMessage(error, "photo"));
		} finally {
			importInProgressRef.current = false;
			setIsProcessing(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	function removeAsset(assetId: string) {
		const current = latestDraftRef.current;
		if (!current || isProcessing) return;
		const index = current.assets.findIndex((asset) => asset.id === assetId);
		const removed = current.assets[index];
		if (!removed) return;
		const assets = current.assets.filter((asset) => asset.id !== assetId);
		const next = {
			...current,
			assets,
			started: current.started || assets.length > 0,
		};
		void persist({ ...next, document: rebuildDocument(next, assets) });
		setStatus("Photo removed from this setup.");
		// Removal is immediate, so offer an undo instead of a confirmation dialog.
		toast("Photo removed", {
			description: removed.name,
			action: { label: "Undo", onClick: () => restoreAsset(removed, index) },
		});
	}

	function restoreAsset(asset: StoredAsset, index: number) {
		const current = latestDraftRef.current;
		if (
			!current ||
			isProcessing ||
			current.assets.length >= 30 ||
			current.assets.some((item) => item.id === asset.id)
		)
			return;
		const assets = [
			...current.assets.slice(0, index),
			asset,
			...current.assets.slice(index),
		];
		const next = { ...current, assets, started: true };
		void persist({ ...next, document: rebuildDocument(next, assets) });
		setStatus("Photo restored.");
	}

	async function continueToStudio() {
		const current = latestDraftRef.current;
		if (
			!current ||
			navigationInProgressRef.current ||
			importInProgressRef.current
		)
			return;
		navigationInProgressRef.current = true;
		setIsNavigating(true);
		try {
			const next = { ...current, step: 3 as CreationStep };
			if (!(await persist(next, 3))) return;
			await navigate({ to: "/studio", search: { draft: current.id } });
		} catch (error) {
			setActionError(actionErrorMessage(error, "save"));
		} finally {
			navigationInProgressRef.current = false;
			setIsNavigating(false);
		}
	}

	async function continueToAuth(mode: "signin" | "signup") {
		const current = latestDraftRef.current;
		if (
			!current ||
			navigationInProgressRef.current ||
			importInProgressRef.current
		)
			return;
		navigationInProgressRef.current = true;
		setIsNavigating(true);
		try {
			if (!(await persist(current, step))) return;
			const returnTo = `/studio?draft=${encodeURIComponent(current.id)}`;
			window.location.assign(
				`/login?returnTo=${encodeURIComponent(returnTo)}&mode=${mode}`,
			);
		} finally {
			navigationInProgressRef.current = false;
			setIsNavigating(false);
		}
	}

	if (draftLoadError) {
		return (
			<main className="creation-page" id="main-content">
				<div className="creation-load-error" role="alert">
					<p className="eyebrow eyebrow--blue">Draft unavailable</p>
					<h1>We couldn’t open this print setup.</h1>
					<p>{draftLoadError}</p>
					<div>
						{missingExplicitDraft ? (
							<Link
								className="creation-load-error__link"
								to="/create"
								search={{ resume: false }}
							>
								Start a new print
							</Link>
						) : (
							<Button type="button" onClick={() => window.location.reload()}>
								Try again
							</Button>
						)}
						<Link className="creation-load-error__link" to="/">
							Return home
						</Link>
					</div>
				</div>
			</main>
		);
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
							onClick={() => void goToStep((step - 1) as CreationStep)}
							disabled={isBusy}
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
						disabled={isBusy}
						resumeCandidate={resumeCandidate}
						onResume={() => {
							if (!resumeCandidate) return;
							if (isBusy) return;
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
						isBusy={isBusy}
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
						isBusy={isBusy}
						onProjectName={(projectName) => {
							const current = latestDraftRef.current;
							if (current) void persist({ ...current, projectName });
						}}
						onContinue={continueToStudio}
						onAuth={continueToAuth}
						onEditFormat={() => void goToStep(1)}
						onEditPhotos={() => void goToStep(2)}
					/>
				) : null}

				<div className="creation-footer">
					{step > 1 ? (
						<Button
							type="button"
							variant="outline"
							onClick={() => void goToStep((step - 1) as CreationStep)}
							disabled={isBusy}
						>
							<ArrowLeft aria-hidden="true" /> Back
						</Button>
					) : (
						<span />
					)}
					{step < 3 ? (
						<Button
							type="button"
							onClick={() => void goToStep((step + 1) as CreationStep)}
							disabled={isBusy}
						>
							{step === 1 ? "Next: Add your photos" : "Next: Review"}
							<ArrowRight aria-hidden="true" />
						</Button>
					) : null}
				</div>
				{actionError ? (
					<div
						className="creation-action-notice"
						role="alert"
						tabIndex={-1}
						ref={actionErrorRef}
					>
						<CircleAlert aria-hidden="true" />
						<p>{actionError}</p>
					</div>
				) : null}
				{isSaving ? (
					<p className="creation-status" role="status">
						Saving your setup…
					</p>
				) : null}
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
	disabled,
	resumeCandidate,
	onResume,
}: {
	product: (typeof catalog)[number];
	selectedId: string;
	onSelect: (productId: string) => void;
	disabled: boolean;
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
				<h2 id="format-step-title" tabIndex={-1}>
					Pick a format for your print.
				</h2>
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
								disabled={disabled}
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
	isBusy,
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
	isBusy: boolean;
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
				<h2 id="prepare-step-title" tabIndex={-1}>
					Start with photos or a template.
				</h2>
				<p>
					Choose how to begin. You can adjust the composition in the studio.
					This creates one design; quantity comes later when you submit a demo
					request.
				</p>
			</div>
			<div className="creation-workspace">
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
								disabled={isBusy}
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
											disabled={isBusy}
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
									disabled={isBusy}
									aria-pressed={draft.templateId === template.id}
								>
									<img
										{...responsiveImage(
											template.image,
											"(max-width: 760px) 30vw, 160px",
										)}
										alt=""
									/>
									<span>{template.label}</span>
									<small>{template.category}</small>
								</button>
							))}
						</div>
						<button
							type="button"
							className={`creation-blank ${draft.started && draft.templateId === "blank" ? "is-selected" : ""}`}
							onClick={onStartBlank}
							disabled={isBusy}
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
				<aside className="creation-prep-preview" aria-label="Live preview">
					<div className="creation-prep-preview__copy">
						<p className="eyebrow">Live preview</p>
						<h3>See your starting point</h3>
						<p>Your photo or template appears here. Adjust it in the studio.</p>
					</div>
					<DraftCanvas draft={draft} product={product} />
				</aside>
			</div>
		</section>
	);
}

function ReviewStep({
	draft,
	product,
	status,
	isBusy,
	onProjectName,
	onContinue,
	onAuth,
	onEditFormat,
	onEditPhotos,
}: {
	draft: CreationDraft;
	product: (typeof catalog)[number];
	status: string;
	isBusy: boolean;
	onProjectName: (name: string) => void;
	onContinue: () => void | Promise<void>;
	onAuth: (mode: "signin" | "signup") => void | Promise<void>;
	onEditFormat: () => void;
	onEditPhotos: () => void;
}) {
	const {
		session,
		state: sessionState,
		refetch: refetchSession,
	} = useAuthSession();
	return (
		<section
			className="creation-content creation-content--review"
			aria-labelledby="review-step-title"
		>
			<div className="creation-review-heading">
				<p className="eyebrow">Ready to continue</p>
				<h2 id="review-step-title" tabIndex={-1}>
					Review your print.
				</h2>
				<p>
					Name it, check the details, then choose how you want to continue. You
					can still adjust everything in the studio.
				</p>
			</div>
			<div className="creation-workspace">
				<div className="creation-review-grid">
					<div className="creation-review-card">
						<label htmlFor="creation-project-name">Project name</label>
						<input
							id="creation-project-name"
							name="projectName"
							autoComplete="off"
							value={draft.projectName}
							onChange={(event) => onProjectName(event.target.value)}
							placeholder="Untitled memory…"
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
							<button type="button" onClick={onEditFormat} disabled={isBusy}>
								Change format
							</button>
							<button type="button" onClick={onEditPhotos} disabled={isBusy}>
								Change photos
							</button>
						</div>
					</div>
					<div className="creation-auth-card">
						<span className="creation-auth-card__icon">
							<Sparkles aria-hidden="true" />
						</span>
						{sessionState === "authenticated" && session ? (
							<>
								<h3>Ready for the studio</h3>
								<p>
									You’re signed in as {session.user.name}. Open the studio to
									refine the layout, then save or request a review.
								</p>
								<Button
									type="button"
									onClick={() => void onContinue()}
									disabled={isBusy}
								>
									Open the studio <ArrowRight aria-hidden="true" />
								</Button>
							</>
						) : sessionState === "loading" ? (
							<div
								className="creation-auth-card__session-state"
								role="status"
								aria-live="polite"
							>
								<LoaderCircle aria-hidden="true" className="animate-spin" />
								<span>Checking your sign-in status…</span>
							</div>
						) : sessionState === "error" ? (
							<div className="creation-auth-card__session-error" role="alert">
								<CircleAlert aria-hidden="true" />
								<div>
									<h3>We couldn’t check your sign-in</h3>
									<p>
										Your draft is safe. Retry the session check before
										continuing.
									</p>
									<Button
										type="button"
										variant="outline"
										onClick={() => void refetchSession()}
									>
										Try again
									</Button>
								</div>
							</div>
						) : (
							<>
								<h3>How do you want to continue?</h3>
								<p>
									Continue as a guest to edit now. Signing in or creating an
									account is optional in this demo and does not add cloud
									storage yet.
								</p>
								<Button
									type="button"
									onClick={() => void onContinue()}
									disabled={isBusy}
								>
									Continue as guest <ArrowRight aria-hidden="true" />
								</Button>
								<a
									className="creation-auth-card__secondary"
									href={`/login?returnTo=${encodeURIComponent(`/studio?draft=${draft.id}`)}&mode=signin`}
									onClick={(event) => {
										event.preventDefault();
										void onAuth("signin");
									}}
								>
									Sign in and continue
								</a>
								<a
									className="creation-auth-card__secondary"
									href={`/login?returnTo=${encodeURIComponent(`/studio?draft=${draft.id}`)}&mode=signup`}
									onClick={(event) => {
										event.preventDefault();
										void onAuth("signup");
									}}
								>
									Create an account
								</a>
							</>
						)}
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
				<aside className="creation-review-preview" aria-label="Live preview">
					<div className="creation-review-preview__copy">
						<p className="eyebrow">Live preview</p>
						<p>Your chosen format and starting point.</p>
					</div>
					<DraftCanvas draft={draft} product={product} />
				</aside>
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
					<img
						{...responsiveImage(
							productImages[product.kind],
							"(max-width: 900px) 40vw, 260px",
						)}
						alt=""
					/>
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
			style={
				{
					aspectRatio: `${draft.document.width} / ${draft.document.height}`,
					"--ratio": draft.document.width / draft.document.height,
				} as React.CSSProperties
			}
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
					// Same proportion of the artboard width as in the studio, at any preview size.
					fontSize: `${(element.fontSize / document.width) * 100}cqw`,
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
