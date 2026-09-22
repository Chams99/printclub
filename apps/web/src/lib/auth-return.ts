export function getSafeReturnPath(
	value: string | null | undefined,
): string | undefined {
	if (!value) return undefined;
	try {
		const path = decodeURIComponent(value);
		if (
			path.startsWith("/") &&
			!path.startsWith("//") &&
			!path.startsWith("/\\") &&
			!path.includes("\\") &&
			!path.includes(":") &&
			!/[\r\n]/.test(path)
		) {
			return path;
		}
	} catch {
		return undefined;
	}
	return undefined;
}
