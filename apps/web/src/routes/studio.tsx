import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ActionNotice } from "@/components/action-notice";
import { StudioEditor } from "@/components/studio-editor";
import { actionErrorMessage } from "@/lib/action-error";
import { getCreationDraft, loadCreationDraft } from "@/lib/creation-draft";

type StudioSearch = {
	draft?: string;
	product?: string;
	template?: "caption" | "gallery" | "celebration";
	auth?: "export" | "review";
};

export const Route = createFileRoute("/studio")({
	validateSearch: (search: Record<string, unknown>): StudioSearch => ({
		draft:
			typeof search.draft === "string" && search.draft.length <= 128
				? search.draft
				: undefined,
		product:
			typeof search.product === "string" && search.product.length <= 80
				? search.product
				: undefined,
		template:
			search.template === "caption" ||
			search.template === "gallery" ||
			search.template === "celebration"
				? search.template
				: undefined,
		auth:
			search.auth === "export" || search.auth === "review"
				? search.auth
				: undefined,
	}),
	head: () => ({
		meta: [
			{ title: "Studio · printclub" },
			{
				name: "description",
				content:
					"Create and download a photo design preview in the printclub studio.",
			},
		],
	}),
	component: StudioPage,
});

function StudioPage() {
	const { draft: preparedDraft, product, template } = Route.useSearch();
	const navigate = Route.useNavigate();
	const [draftId, setDraftId] = useState<string>();
	const [error, setError] = useState<string>();
	const [attempt, setAttempt] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly reruns the storage read after Retry.
	useEffect(() => {
		let cancelled = false;
		setDraftId(undefined);
		setError(undefined);
		async function prepare() {
			if (!preparedDraft && (product || template)) {
				await navigate({
					to: "/create",
					search: { product, template, resume: false },
					replace: true,
				});
				return;
			}
			const draft = preparedDraft
				? await getCreationDraft(preparedDraft)
				: await loadCreationDraft();
			if (cancelled) return;
			if (draft?.started && draft.step === 3) {
				setDraftId(draft.id);
				return;
			}
			if (preparedDraft && !draft) {
				setError(
					"This design isn’t stored in this browser. Open it on the browser where it was created, or start a new print. Browser links do not share a design between devices.",
				);
				return;
			}
			await navigate({
				to: "/create",
				search: draft
					? { draft: draft.id, step: draft.step, resume: true }
					: { resume: true },
				replace: true,
			});
		}
		void prepare().catch((failure: unknown) => {
			if (!cancelled) setError(actionErrorMessage(failure, "load"));
		});
		return () => {
			cancelled = true;
		};
	}, [preparedDraft, product, template, navigate, attempt]);
	return (
		<main className="studio-page" id="main-content">
			{error ? (
				<ActionNotice title="Design could not be opened" message={error}>
					<button
						className="button-v2 button-v2--ghost"
						type="button"
						onClick={() => setAttempt((value) => value + 1)}
					>
						Retry
					</button>
					<Link
						className="button-v2 button-v2--primary"
						to="/create"
						search={{ resume: false }}
					>
						Start a new print
					</Link>
				</ActionNotice>
			) : draftId ? (
				<StudioEditor key={draftId} draftId={draftId} />
			) : (
				<div className="creation-loading" role="status">
					Preparing your studio…
				</div>
			)}
		</main>
	);
}
