"use client";

import { cn } from "@PhotoPrinting/ui/lib/utils";
import * as React from "react";

function Label({ className, ...props }: React.ComponentProps<"label">) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: Callers provide htmlFor or nesting with the actual control; the generic primitive cannot inspect its use site.
		<label
			data-slot="label"
			className={cn(
				"flex items-center gap-2 text-xs leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
