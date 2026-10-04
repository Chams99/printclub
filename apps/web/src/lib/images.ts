/**
 * Intrinsic sizes and generated width variants of the bundled photography in
 * /public/images (variants come from `bun run images:variants`).
 *
 * `responsiveImage` returns the props for an <img>: the real aspect ratio
 * (prevents layout shift; several photos are portrait, one is landscape) and a
 * srcSet so the browser downloads the smallest file that is sharp for `sizes`.
 */
type PhotoInfo = {
	width: number;
	height: number;
	variants: readonly number[];
};

const photos: Record<string, PhotoInfo> = {
	"/images/printclub-hero.webp": {
		width: 1536,
		height: 1024,
		variants: [480, 768, 1024],
	},
	"/images/template-travel.webp": {
		width: 1024,
		height: 1536,
		variants: [480, 768],
	},
	"/images/template-everyday.webp": {
		width: 1024,
		height: 1536,
		variants: [480, 768],
	},
	"/images/template-celebrations.webp": {
		width: 1024,
		height: 1536,
		variants: [480, 768],
	},
	"/images/template-framed.webp": {
		width: 1122,
		height: 1402,
		variants: [480, 768, 1024],
	},
};

function variantPath(src: string, width: number) {
	return src.replace(/\.webp$/, `-${width}w.webp`);
}

/**
 * @param sizes How wide the image renders, as an <img sizes> value, e.g.
 *   "(max-width: 760px) 100vw, 420px".
 */
export function responsiveImage(src: string, sizes: string) {
	const photo = photos[src];
	if (!photo) return { src };
	const srcSet = [
		...photo.variants.map((width) => `${variantPath(src, width)} ${width}w`),
		`${src} ${photo.width}w`,
	].join(", ");
	return { src, srcSet, sizes, width: photo.width, height: photo.height };
}
