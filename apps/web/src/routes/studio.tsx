import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { StudioEditor } from "@/components/studio-editor";
import { getCreationDraft, loadCreationDraft } from "@/lib/creation-draft";

export const Route = createFileRoute("/studio")({
	head: () => ({
		meta: [
			{ title: "Studio · printclub" },
			{
				name: "description",
				content: "Create a print-ready photo design in the printclub studio.",
			},
		],
	}),
	component: StudioPage,
});

function StudioPage() {
	const [ready, setReady] = useState(false);
	const [draftId, setDraftId] = useState<string>();

	useEffect(() => {
		let cancelled = false;
		const params = new URLSearchParams(window.location.search);
		const preparedDraft = params.get("draft");
		const product = params.get("product");
		const template = params.get("template");
		if (preparedDraft) {
			void getCreationDraft(preparedDraft).then((draft) => {
				if (cancelled) return;
				if (draft) {
					setDraftId(draft.id);
					setReady(true);
					return;
				}
				window.location.replace("/create?resume=true");
			});
			return () => {
				cancelled = true;
			};
		}
		if (product || template) {
			const next = new URLSearchParams();
			if (product) next.set("product", product);
			if (["caption", "gallery", "celebration"].includes(template ?? "")) {
				next.set("template", template ?? "");
			}
			window.location.replace(`/create?${next.toString()}`);
			return () => {
				cancelled = true;
			};
		}
		void loadCreationDraft().then((draft) => {
			if (cancelled) return;
			if (draft?.started && draft.step === 3) {
				setDraftId(draft.id);
				setReady(true);
				return;
			}
			if (draft) {
				window.location.replace(`/create?draft=${draft.id}&step=${draft.step}`);
				return;
			}
			window.location.replace("/create?resume=true");
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<main className="studio-page" id="main-content">
			{ready ? (
				<StudioEditor draftId={draftId} />
			) : (
				<div className="creation-loading" role="status">
					Preparing your studio…
				</div>
			)}
		</main>
	);
}
