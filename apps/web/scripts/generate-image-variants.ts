/**
 * Writes smaller WebP copies of the bundled photography so pages can serve a
 * size that fits each slot (a 52px thumbnail should not download 1536px).
 *
 *   bun run images:variants
 *
 * Re-run after adding or replacing a photo in public/images, then add the new
 * file and its intrinsic size to src/lib/images.ts.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

const imagesDir = join(import.meta.dir, "..", "public", "images");
export const variantWidths = [480, 768, 1024] as const;

const sources = (await readdir(imagesDir)).filter(
	(file) => file.endsWith(".webp") && !/-\d+w\.webp$/.test(file),
);

for (const file of sources) {
	const input = join(imagesDir, file);
	const { width = 0 } = await sharp(input).metadata();
	for (const target of variantWidths) {
		if (target >= width) continue;
		const output = join(imagesDir, file.replace(/\.webp$/, `-${target}w.webp`));
		const info = await sharp(input)
			.resize({ width: target })
			.webp({ quality: 78, effort: 6 })
			.toFile(output);
		console.info(`${file} → ${target}w (${Math.round(info.size / 1024)} KB)`);
	}
}
